"""
Uptime Kuma seed sidecar — M4.6.

Idempotent one-shot. Bootstraps the admin account on a fresh volume,
then ensures the configured notifications + monitors + status page exist
exactly as monitors.json describes. Subsequent runs reconcile in place:
matching names are updated, new names are created, unknown names are
left alone (operator UI edits survive re-seeding).

Talks to Kuma via the uptime-kuma-api Python library, which speaks
socket.io under the hood (Kuma 1.x exposes its API as socket.io events,
not REST — the official REST API is 2.x-only and still in beta as of
2026-05). Library docs: https://uptime-kuma-api.readthedocs.io/

Run model: this script is wired in docker-compose.yml as the
`uptime-kuma-init` service with `restart: "no"`, depends_on
uptime-kuma:service_healthy, and exits 0 once seeding completes.
Same one-shot shape as the existing `keycloak-realm-init` and
`backend-storage-init` services — see those entries in
docker-compose.yml for the prior art. In K8s the equivalent is a Job
(helm/myproperty/templates/monitoring/uptime-kuma-seed-job.yaml).

Environment contract (every var optional except KUMA_BASE_URL +
KUMA_ADMIN_PASSWORD; defaults documented in docker-compose.yml):

    KUMA_BASE_URL          — http://uptime-kuma:3001 in compose;
                             http://uptime-kuma:3001 in K8s.
    KUMA_ADMIN_USERNAME    — admin (default).
    KUMA_ADMIN_PASSWORD    — required, must be ≥10 chars per Kuma's
                             setup validation.
    KUMA_PUBLIC_URL        — URL the status page advertises in its
                             "Powered by" link.
    SLACK_WEBHOOK_URL      — empty value skips the Slack channel.
    KUMA_SMTP_HOST / *_PORT / *_FROM / *_TO — empty *_HOST skips the
                             email channel entirely.
    KUMA_LOG_LEVEL         — INFO (default) | DEBUG | WARNING.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any

from uptime_kuma_api import (
    MonitorType,
    NotificationType,
    UptimeKumaApi,
    UptimeKumaException,
)


# ── Logging ──────────────────────────────────────────────────────────────────
# Same format as the aiops-webhook (M4.11) so Promtail's container-stdout
# pipeline picks both up with identical labels in Loki.
LOG_LEVEL = os.environ.get("KUMA_LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S%z",
)
log = logging.getLogger("kuma-seed")


# ── Config ───────────────────────────────────────────────────────────────────
KUMA_BASE_URL = os.environ.get("KUMA_BASE_URL", "http://uptime-kuma:3001")
KUMA_ADMIN_USERNAME = os.environ.get("KUMA_ADMIN_USERNAME", "admin")
KUMA_ADMIN_PASSWORD = os.environ.get("KUMA_ADMIN_PASSWORD", "")
KUMA_PUBLIC_URL = os.environ.get("KUMA_PUBLIC_URL", "http://localhost:3002")

SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "").strip()
KUMA_SMTP_HOST = os.environ.get("KUMA_SMTP_HOST", "").strip()
KUMA_SMTP_PORT = int(os.environ.get("KUMA_SMTP_PORT", "1025"))
KUMA_SMTP_FROM = os.environ.get("KUMA_SMTP_FROM", "uptime@myproperty.local")
KUMA_SMTP_TO = os.environ.get("KUMA_SMTP_TO", "oncall@myproperty.local")

# Kuma's setup endpoint enforces a 10-char minimum. Fail loud rather than let
# the call return a confusing 422.
MIN_PASSWORD_LEN = 10

SEED_FILE = Path(__file__).parent / "monitors.json"

# Kuma needs a few seconds after healthcheck-pass before the socket.io
# transport is fully accepting auth — retry the initial connect.
CONNECT_MAX_ATTEMPTS = 30
CONNECT_BACKOFF_SECONDS = 2.0


# ── Helpers ──────────────────────────────────────────────────────────────────
def load_seed() -> dict[str, Any]:
    if not SEED_FILE.exists():
        log.error("Seed file missing at %s", SEED_FILE)
        sys.exit(2)
    with SEED_FILE.open(encoding="utf-8") as fp:
        return json.load(fp)


def connect_with_retry() -> UptimeKumaApi:
    """Open the socket.io connection; tolerate Kuma still warming up."""
    last_exc: Exception | None = None
    for attempt in range(1, CONNECT_MAX_ATTEMPTS + 1):
        try:
            api = UptimeKumaApi(KUMA_BASE_URL, wait_timeout=15)
            log.info("Connected to Kuma at %s (attempt %d)", KUMA_BASE_URL, attempt)
            return api
        except Exception as exc:
            last_exc = exc
            log.debug("Connect attempt %d failed: %s", attempt, exc)
            time.sleep(CONNECT_BACKOFF_SECONDS)
    log.error("Could not connect to Kuma at %s after %d attempts: %s",
              KUMA_BASE_URL, CONNECT_MAX_ATTEMPTS, last_exc)
    sys.exit(3)


def ensure_admin(api: UptimeKumaApi) -> None:
    """First-run: create the admin user. Re-run: login with existing creds.

    Kuma's `need_setup()` returns True only on a virgin volume; once the
    admin exists the call returns False and we just login. Idempotent
    across compose restarts.
    """
    if api.need_setup():
        if len(KUMA_ADMIN_PASSWORD) < MIN_PASSWORD_LEN:
            log.error(
                "KUMA_ADMIN_PASSWORD must be at least %d characters "
                "(Kuma's own setup validation rejects shorter passwords).",
                MIN_PASSWORD_LEN,
            )
            sys.exit(4)
        log.info("Fresh Kuma volume — running first-time setup for user '%s'",
                 KUMA_ADMIN_USERNAME)
        api.setup(KUMA_ADMIN_USERNAME, KUMA_ADMIN_PASSWORD)
    else:
        log.info("Kuma admin already configured — skipping setup")

    api.login(KUMA_ADMIN_USERNAME, KUMA_ADMIN_PASSWORD)
    log.info("Logged in as '%s'", KUMA_ADMIN_USERNAME)


def upsert_notifications(api: UptimeKumaApi,
                         specs: list[dict[str, Any]]) -> dict[str, int]:
    """Create or update each notification by name; return name → id map."""
    existing = {n["name"]: n for n in api.get_notifications()}
    name_to_id: dict[str, int] = {}

    for spec in specs:
        name = spec["name"]
        type_key = spec["type"]
        is_default = bool(spec.get("isDefault", False))
        apply_existing = bool(spec.get("applyExisting", False))
        cfg = spec.get("config", {})

        if type_key == "slack":
            if not SLACK_WEBHOOK_URL:
                log.info("Skipping Slack notification '%s' — SLACK_WEBHOOK_URL is empty",
                         name)
                continue
            kwargs: dict[str, Any] = {
                "name": name,
                "type": NotificationType.SLACK,
                "isDefault": is_default,
                "applyExisting": apply_existing,
                "slackwebhookURL": SLACK_WEBHOOK_URL,
                **cfg,
            }

        elif type_key == "smtp":
            if not KUMA_SMTP_HOST:
                log.info("Skipping SMTP notification '%s' — KUMA_SMTP_HOST is empty",
                         name)
                continue
            kwargs = {
                "name": name,
                "type": NotificationType.SMTP,
                "isDefault": is_default,
                "applyExisting": apply_existing,
                "smtpHost": KUMA_SMTP_HOST,
                "smtpPort": KUMA_SMTP_PORT,
                "smtpFrom": KUMA_SMTP_FROM,
                "smtpTo": KUMA_SMTP_TO,
                **cfg,
            }

        else:
            log.warning("Unknown notification type '%s' for '%s' — skipping",
                        type_key, name)
            continue

        if name in existing:
            existing_id = existing[name]["id"]
            log.info("Updating notification '%s' (id=%d)", name, existing_id)
            api.edit_notification(existing_id, **kwargs)
            name_to_id[name] = existing_id
        else:
            log.info("Creating notification '%s'", name)
            result = api.add_notification(**kwargs)
            name_to_id[name] = result["id"]

    return name_to_id


def upsert_monitors(api: UptimeKumaApi,
                    specs: list[dict[str, Any]],
                    notification_ids: list[int]) -> dict[str, int]:
    """Create or update each monitor by name; return name → id map."""
    existing = {m["name"]: m for m in api.get_monitors()}
    name_to_id: dict[str, int] = {}

    for spec in specs:
        name = spec["name"]
        type_key = spec["type"]

        # Map our JSON type → uptime-kuma-api MonitorType enum.
        try:
            monitor_type = {
                "http": MonitorType.HTTP,
                "postgres": MonitorType.POSTGRES,
                "redis": MonitorType.REDIS,
            }[type_key]
        except KeyError:
            log.warning("Unknown monitor type '%s' for '%s' — skipping",
                        type_key, name)
            continue

        kwargs: dict[str, Any] = {
            "name": name,
            "type": monitor_type,
            "interval": spec.get("interval", 60),
            "maxretries": spec.get("maxretries", 0),
            "retryInterval": spec.get("retryInterval", 60),
            "notificationIDList": notification_ids,
        }

        if monitor_type == MonitorType.HTTP:
            kwargs.update({
                "url": spec["url"],
                "method": spec.get("method", "GET"),
                "accepted_statuscodes": spec.get(
                    "accepted_statuscodes", ["200-299"]
                ),
            })
            auth_method = spec.get("authMethod")
            if auth_method:
                kwargs["authMethod"] = auth_method
                kwargs["basic_auth_user"] = spec.get("basic_auth_user", "")
                kwargs["basic_auth_pass"] = spec.get("basic_auth_pass", "")
        elif monitor_type in (MonitorType.POSTGRES, MonitorType.REDIS):
            kwargs["databaseConnectionString"] = spec["databaseConnectionString"]
            if "databaseQuery" in spec:
                kwargs["databaseQuery"] = spec["databaseQuery"]

        if name in existing:
            existing_id = existing[name]["id"]
            log.info("Updating monitor '%s' (id=%d)", name, existing_id)
            api.edit_monitor(existing_id, **kwargs)
            name_to_id[name] = existing_id
        else:
            log.info("Creating monitor '%s'", name)
            result = api.add_monitor(**kwargs)
            name_to_id[name] = result["monitorID"]

    return name_to_id


def upsert_status_page(api: UptimeKumaApi,
                       spec: dict[str, Any],
                       monitor_ids: dict[str, int]) -> None:
    """Create or refresh the public status page."""
    slug = spec["slug"]

    public_group = {
        "name": spec.get("publicGroupName", "Services"),
        "monitorList": [
            {"id": monitor_ids[n]}
            for n in spec.get("publicMonitors", [])
            if n in monitor_ids
        ],
    }
    internal_monitors = [
        {"id": monitor_ids[n]}
        for n in spec.get("internalMonitors", [])
        if n in monitor_ids
    ]
    public_group_list = [public_group]
    if internal_monitors:
        public_group_list.append({
            "name": spec.get("internalGroupName", "Internal"),
            "monitorList": internal_monitors,
        })

    payload: dict[str, Any] = {
        "title": spec["title"],
        "description": spec.get("description", ""),
        "theme": spec.get("theme", "auto"),
        "published": spec.get("published", True),
        "showTags": spec.get("showTags", False),
        "showPoweredBy": spec.get("showPoweredBy", False),
        "publicGroupList": public_group_list,
        "domainNameList": [],
        "customCSS": "",
        "footerText": f"Status page · {KUMA_PUBLIC_URL}",
    }

    existing_pages = {p["slug"]: p for p in api.get_status_pages()}
    if slug in existing_pages:
        log.info("Updating status page '/status/%s'", slug)
        api.save_status_page(slug=slug, **payload)
    else:
        log.info("Creating status page '/status/%s'", slug)
        # add_status_page requires (slug, title); save_status_page then writes
        # the full payload including group/monitor wiring.
        api.add_status_page(slug=slug, title=spec["title"])
        api.save_status_page(slug=slug, **payload)


# ── Entry point ──────────────────────────────────────────────────────────────
def main() -> int:
    log.info("Uptime Kuma seed starting — base=%s public=%s",
             KUMA_BASE_URL, KUMA_PUBLIC_URL)
    seed = load_seed()

    api = connect_with_retry()
    try:
        ensure_admin(api)

        notif_name_to_id = upsert_notifications(api, seed.get("notifications", []))
        notification_ids = list(notif_name_to_id.values())
        log.info("Notifications ready: %d channel(s) wired",
                 len(notification_ids))

        monitor_name_to_id = upsert_monitors(
            api, seed.get("monitors", []), notification_ids,
        )
        log.info("Monitors ready: %d total", len(monitor_name_to_id))

        status_page = seed.get("statusPage")
        if status_page:
            upsert_status_page(api, status_page, monitor_name_to_id)
            log.info("Status page '/status/%s' available at %s/status/%s",
                     status_page["slug"], KUMA_PUBLIC_URL.rstrip("/"),
                     status_page["slug"])
        else:
            log.info("No statusPage section in seed — skipping")

    except UptimeKumaException as exc:
        log.error("Kuma API error: %s", exc)
        return 5
    finally:
        api.disconnect()

    log.info("Seed complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
