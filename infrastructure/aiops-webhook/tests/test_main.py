"""Minimal pytest suite for the aiops-webhook service.

Inline fixtures, no file I/O. Tests boundary contracts:
  - Alertmanager payload parsing (Pydantic happy path + extra-field tolerance)
  - Discord embed rendering for firing alerts (includes triage)
  - Discord embed rendering for resolved alerts (no triage, RESOLVED title)
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


def test_build_discord_payload_firing_includes_triage():
    """Firing alert with triage text renders the Triage section in the embed."""
    alert = main.Alert(**FIRING_PAYLOAD["alerts"][0])
    payload = main.build_discord_payload(alert, "firing", "Triage text here.")
    embed = payload["embeds"][0]
    assert "Triage" in embed["description"]
    assert "Triage text here." in embed["description"]
    assert "[CRITICAL]" in embed["title"]
    # content one-liner is the mobile-push fallback.
    assert payload["content"].startswith("[FIRING]")


def test_build_discord_payload_resolved_omits_triage():
    """Resolved alerts skip triage (even if provided) and use the RESOLVED title."""
    alert = main.Alert(**FIRING_PAYLOAD["alerts"][0])
    payload = main.build_discord_payload(alert, "resolved", "Should be ignored.")
    embed = payload["embeds"][0]
    assert "Should be ignored." not in embed.get("description", "")
    assert "Triage" not in embed.get("description", "")
    assert "RESOLVED" in embed["title"]
    assert embed["color"] == main.RESOLVED_COLOR


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
        patch.object(main, "DISCORD_WEBHOOK_URL", ""),
    ):
        client = TestClient(main.app)
        response = client.post("/alerts", json=FIRING_PAYLOAD)
    assert response.status_code == 202
    body = response.json()
    assert body["received"] == 1
    assert body["queued"] is True
