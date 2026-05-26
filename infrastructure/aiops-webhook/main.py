"""
AIOps webhook receiver — M4.11.

Receives Alertmanager webhook POSTs at /alerts, triages firing alerts via
Anthropic Claude, and posts results to Slack as Block Kit messages. For
resolved alerts, skips the LLM and posts a short resolution.

Graceful degradation paths (so `docker compose up` on a fresh clone works
without any external accounts):
  - ANTHROPIC_API_KEY unset → LLM call is skipped; raw labels/annotations
    are posted to Slack with a "Triage disabled" header.
  - SLACK_WEBHOOK_URL unset → Slack messages are logged to stdout, where
    Promtail picks them up and ships them to Loki. The demo flow is still
    visible in Grafana even without a Slack workspace.
"""

import logging
import os
from datetime import datetime, timezone
from typing import Any

import anthropic
import httpx
from fastapi import BackgroundTasks, FastAPI, status
from pydantic import BaseModel, ConfigDict, Field

# ── Config ────────────────────────────────────────────────────
# All settings read from env at import. Optional vars degrade rather than
# raise — missing config produces a startup warning and a different runtime
# path, not a crash.
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip()
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001").strip()
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "").strip()
LOG_LEVEL = os.environ.get("AIOPS_LOG_LEVEL", "INFO").upper()
CLAUDE_TIMEOUT_SECONDS = float(os.environ.get("AIOPS_CLAUDE_TIMEOUT_SECONDS", "15"))
SLACK_TIMEOUT_SECONDS = float(os.environ.get("AIOPS_SLACK_TIMEOUT_SECONDS", "10"))

logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("aiops")

if not ANTHROPIC_API_KEY:
    log.warning("ANTHROPIC_API_KEY unset — LLM triage disabled, alerts will post raw")
if not SLACK_WEBHOOK_URL:
    log.warning("SLACK_WEBHOOK_URL unset — Slack messages will be logged to stdout")

claude_client: anthropic.Anthropic | None = None
if ANTHROPIC_API_KEY:
    claude_client = anthropic.Anthropic(
        api_key=ANTHROPIC_API_KEY,
        timeout=CLAUDE_TIMEOUT_SECONDS,
    )


# ── Alertmanager webhook payload models ──────────────────────
# Shape: https://prometheus.io/docs/alerting/latest/configuration/#webhook_config
# `extra="ignore"` so a future Alertmanager version that adds fields doesn't
# break ingestion — we only read what we care about.
class Alert(BaseModel):
    model_config = ConfigDict(extra="ignore")
    status: str
    labels: dict[str, str] = Field(default_factory=dict)
    annotations: dict[str, str] = Field(default_factory=dict)
    startsAt: str = ""
    endsAt: str = ""
    generatorURL: str = ""
    fingerprint: str = ""


class AlertmanagerPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")
    version: str = "4"
    status: str
    receiver: str = ""
    groupKey: str = ""
    groupLabels: dict[str, str] = Field(default_factory=dict)
    commonLabels: dict[str, str] = Field(default_factory=dict)
    commonAnnotations: dict[str, str] = Field(default_factory=dict)
    externalURL: str = ""
    alerts: list[Alert] = Field(default_factory=list)


# ── LLM triage ────────────────────────────────────────────────
# The system prompt is static — every triage uses the same instructions.
# Marking it cache_control=ephemeral means a burst of alerts during an
# incident pays the system-prompt tokens once per 5-minute window.
SYSTEM_PROMPT = """You are an on-call SRE assistant for the MyProperty platform.
You receive Prometheus / Alertmanager alerts and must produce a short triage
summary for the on-call engineer. Be precise, actionable, and brief.

Output exactly four sections, each plain text (no markdown headers):

Summary: one or two sentences explaining what the alert means in plain English.

Likely cause: two or three specific hypotheses ranked by probability. Reference
the labels and annotations on the alert. Be concrete — not "investigate the
system" but "Postgres connection pool is exhausted because <reason>".

First actions: a numbered list of 3-5 commands or checks the on-call engineer
should run right now. Prefer commands they can copy-paste. If the alert
includes a runbook_url, mention it.

Severity assessment: one sentence on user impact and whether this needs paging
someone or can wait for business hours."""


def triage_alert(alert: Alert, payload_status: str) -> str | None:
    """Call Claude with the alert details and return triage text, or None if LLM is disabled.

    Returns None when claude_client is None — callers render a small context block instead
    of a full triage section. Returns a fallback string if the call succeeds but errors.
    Never raises — the webhook contract is "AM gets a 2xx no matter what."
    """
    if claude_client is None:
        return None

    labels_block = "\n".join(f"  {k}: {v}" for k, v in sorted(alert.labels.items()))
    annotations_block = "\n".join(
        f"  {k}: {v}" for k, v in sorted(alert.annotations.items())
    )
    user_prompt = (
        f"Alert status: {alert.status} (group status: {payload_status})\n"
        f"Started at: {alert.startsAt}\n"
        f"Fingerprint: {alert.fingerprint}\n"
        f"\n"
        f"Labels:\n{labels_block}\n"
        f"\n"
        f"Annotations:\n{annotations_block}\n"
    )

    try:
        message = claude_client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=1024,
            system=[
                {
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            messages=[{"role": "user", "content": user_prompt}],
        )
        text_blocks = [block.text for block in message.content if block.type == "text"]
        if hasattr(message, "usage") and message.usage is not None:
            log.info(
                "Claude usage input=%s output=%s cache_read=%s cache_create=%s",
                getattr(message.usage, "input_tokens", "?"),
                getattr(message.usage, "output_tokens", "?"),
                getattr(message.usage, "cache_read_input_tokens", 0),
                getattr(message.usage, "cache_creation_input_tokens", 0),
            )
        return "".join(text_blocks).strip() or "(Claude returned no text)"
    except Exception:
        log.exception("Claude triage call failed; falling back to raw alert dump")
        return f"Triage call failed; raw alert details follow.\n\n{user_prompt}"


# ── Slack delivery ────────────────────────────────────────────
SEVERITY_EMOJI = {
    "critical": ":rotating_light:",
    "warning": ":warning:",
    "info": ":information_source:",
}


def build_slack_blocks(
    alert: Alert,
    alert_status: str,
    triage_text: str | None,
) -> list[dict[str, Any]]:
    """Render one alert as a Block Kit message. Block list is in `blocks`;
    callers should also pass a plain-text `text` summary as a notification
    fallback for screen readers + mobile push previews."""
    alertname = alert.labels.get("alertname", "Unknown alert")
    severity = alert.labels.get("severity", "info")
    emoji = SEVERITY_EMOJI.get(severity, ":bell:")

    if alert_status == "resolved":
        header_text = f":white_check_mark: [RESOLVED] {alertname}"
    else:
        header_text = f"{emoji} [{severity.upper()}] {alertname}"

    blocks: list[dict[str, Any]] = [
        {
            "type": "header",
            # Slack header text caps at 150 chars; truncate defensively.
            "text": {"type": "plain_text", "text": header_text[:150], "emoji": True},
        },
    ]

    summary = alert.annotations.get("summary", "")
    if summary:
        blocks.append(
            {"type": "section", "text": {"type": "mrkdwn", "text": f"*{summary}*"}}
        )

    fields: list[dict[str, str]] = []
    if alert.startsAt:
        fields.append({"type": "mrkdwn", "text": f"*Started:*\n{alert.startsAt}"})
    if alert_status == "resolved" and alert.endsAt:
        fields.append({"type": "mrkdwn", "text": f"*Resolved:*\n{alert.endsAt}"})
    if service := alert.labels.get("service"):
        fields.append({"type": "mrkdwn", "text": f"*Service:*\n{service}"})
    if instance := alert.labels.get("instance"):
        fields.append({"type": "mrkdwn", "text": f"*Instance:*\n{instance}"})
    if fields:
        blocks.append({"type": "section", "fields": fields})

    description = alert.annotations.get("description")
    if description:
        blocks.append(
            {"type": "section", "text": {"type": "mrkdwn", "text": description}}
        )

    if triage_text and alert_status != "resolved":
        # Slack section text caps at 3000 chars.
        blocks.append(
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*Triage*\n{triage_text[:2900]}"},
            }
        )
    elif alert_status != "resolved" and triage_text is None and not ANTHROPIC_API_KEY:
        blocks.append(
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": "_Triage disabled — ANTHROPIC_API_KEY unset._",
                    }
                ],
            }
        )

    accessory_buttons: list[dict[str, Any]] = []
    if runbook := alert.annotations.get("runbook_url"):
        accessory_buttons.append(
            {
                "type": "button",
                "text": {"type": "plain_text", "text": "Runbook"},
                "url": runbook,
            }
        )
    if alert.generatorURL:
        accessory_buttons.append(
            {
                "type": "button",
                "text": {"type": "plain_text", "text": "Prometheus"},
                "url": alert.generatorURL,
            }
        )
    if accessory_buttons:
        blocks.append({"type": "actions", "elements": accessory_buttons})

    blocks.append({"type": "divider"})
    return blocks


def post_to_slack(blocks: list[dict[str, Any]], summary_text: str) -> None:
    """POST a Block Kit payload to the Slack incoming webhook.

    `summary_text` is the plain-text fallback Slack uses for notifications,
    accessibility, and clients that don't render blocks. Failures are
    logged but never raised — see the always-2xx contract on /alerts."""
    payload = {"text": summary_text, "blocks": blocks}
    if not SLACK_WEBHOOK_URL:
        log.info("Slack webhook not configured; would have sent: %s", summary_text)
        log.debug("Slack payload (stdout fallback): %s", payload)
        return
    try:
        with httpx.Client(timeout=SLACK_TIMEOUT_SECONDS) as client:
            response = client.post(SLACK_WEBHOOK_URL, json=payload)
            if response.status_code != 200:
                log.error(
                    "Slack returned %s: %s",
                    response.status_code,
                    response.text[:200],
                )
            else:
                log.info("Posted to Slack: %s", summary_text)
    except Exception:
        log.exception("Slack post failed")


# ── FastAPI app ───────────────────────────────────────────────
app = FastAPI(title="MyProperty AIOps Webhook", version="1.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}


def process_payload(payload: AlertmanagerPayload) -> None:
    """Process each alert in the payload — runs in background after /alerts returns 202."""
    for alert in payload.alerts:
        alertname = alert.labels.get("alertname", "unknown")
        severity = alert.labels.get("severity", "info")
        log.info(
            "Processing alert name=%s severity=%s status=%s fingerprint=%s",
            alertname,
            severity,
            alert.status,
            alert.fingerprint,
        )
        triage_text: str | None = None
        if alert.status == "firing":
            triage_text = triage_alert(alert, payload.status)
        blocks = build_slack_blocks(alert, alert.status, triage_text)
        summary_text = f"[{alert.status.upper()}] {alertname} ({severity})"
        post_to_slack(blocks, summary_text)


@app.post("/alerts", status_code=status.HTTP_202_ACCEPTED)
def alerts(
    payload: AlertmanagerPayload, background_tasks: BackgroundTasks
) -> dict[str, Any]:
    """Alertmanager webhook target.

    Returns 202 immediately after queuing background work — keeps the response
    inside AM's default 10s http_config.timeout even when Claude is slow.
    Always returns 2xx — AM retries non-2xx, which would compound a transient
    LLM/Slack outage into an alert storm. Failures inside process_payload are
    logged and swallowed; the firing alert stays visible in Prometheus +
    Alertmanager + Grafana UIs regardless."""
    log.info(
        "Received AM payload status=%s receiver=%s alerts=%d",
        payload.status,
        payload.receiver,
        len(payload.alerts),
    )
    background_tasks.add_task(process_payload, payload)
    return {"received": len(payload.alerts), "queued": True}
