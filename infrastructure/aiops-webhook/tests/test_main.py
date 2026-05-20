"""Minimal pytest suite for the aiops-webhook service.

Inline fixtures, no file I/O. Tests boundary contracts:
  - Alertmanager payload parsing (Pydantic happy path + extra-field tolerance)
  - Block Kit rendering for firing alerts
  - Block Kit rendering for resolved alerts (no triage section)
  - LLM-disabled path returns None from triage_alert (clean fallback)
  - /alerts endpoint returns 202 even when no LLM key is configured
"""

from unittest.mock import patch
from fastapi.testclient import TestClient

import main


FIRING_PAYLOAD = {
    "version": "4",
    "status": "firing",
    "receiver": "aiops-webhook",
    "alerts": [
        {
            "status": "firing",
            "labels": {
                "alertname": "MyPropertyApiDown",
                "severity": "critical",
                "service": "api",
            },
            "annotations": {
                "summary": "MyProperty API is down",
                "description": "Scrape failed for 2 minutes.",
            },
            "startsAt": "2026-05-19T14:32:01Z",
            "endsAt": "0001-01-01T00:00:00Z",
            "fingerprint": "deadbeef",
        }
    ],
}


def test_alertmanager_payload_parses_with_extra_fields():
    """extra='ignore' tolerates new AM versions adding fields."""
    payload_with_extra = {**FIRING_PAYLOAD, "newFieldFromFutureAM": "irrelevant"}
    parsed = main.AlertmanagerPayload(**payload_with_extra)
    assert parsed.status == "firing"
    assert len(parsed.alerts) == 1
    assert parsed.alerts[0].labels["alertname"] == "MyPropertyApiDown"


def test_build_slack_blocks_firing_includes_triage_section():
    """Firing alert with triage text renders a Triage section block."""
    alert = main.Alert(**FIRING_PAYLOAD["alerts"][0])
    blocks = main.build_slack_blocks(alert, "firing", "Triage text here.")
    triage_blocks = [
        b
        for b in blocks
        if b.get("type") == "section"
        and isinstance(b.get("text"), dict)
        and "Triage" in b["text"].get("text", "")
    ]
    assert len(triage_blocks) == 1


def test_build_slack_blocks_resolved_omits_triage_section():
    """Resolved alerts skip the triage section even if triage_text is provided."""
    alert = main.Alert(**FIRING_PAYLOAD["alerts"][0])
    blocks = main.build_slack_blocks(alert, "resolved", "Should be ignored.")
    triage_blocks = [
        b
        for b in blocks
        if b.get("type") == "section"
        and isinstance(b.get("text"), dict)
        and "Triage" in b["text"].get("text", "")
    ]
    assert triage_blocks == []
    header = next(b for b in blocks if b.get("type") == "header")
    assert "RESOLVED" in header["text"]["text"]


def test_triage_alert_returns_none_when_llm_disabled():
    """LLM-disabled path returns None — callers skip the triage block entirely."""
    alert = main.Alert(**FIRING_PAYLOAD["alerts"][0])
    with patch.object(main, "claude_client", None):
        result = main.triage_alert(alert, "firing")
    assert result is None


def test_alerts_endpoint_returns_202_with_no_api_key():
    """The webhook accepts payloads and queues background work even when triage is disabled."""
    with (
        patch.object(main, "claude_client", None),
        patch.object(main, "SLACK_WEBHOOK_URL", ""),
    ):
        client = TestClient(main.app)
        response = client.post("/alerts", json=FIRING_PAYLOAD)
    assert response.status_code == 202
    body = response.json()
    assert body["received"] == 1
    assert body["queued"] is True
