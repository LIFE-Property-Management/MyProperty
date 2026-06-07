"""Structure guard for the M5.8 n8n tenant-inquiry workflow.

The workflow is hand/generator-authored JSON that gets imported into n8n on
boot. There's no n8n runtime here — these tests assert the invariants that make
the import + the graceful-degradation contract hold, so an accidental edit
(renamed node, dropped onError, broken wiring) fails CI instead of silently
breaking the pipeline at `docker compose up`. The end-to-end behaviour itself is
verified by running n8n (see docs/operations/n8n-automation.md).
"""

import json
import pathlib

import pytest

WORKFLOW_PATH = pathlib.Path(__file__).resolve().parents[1] / "workflows" / "tenant-inquiry.json"


@pytest.fixture(scope="module")
def workflow():
    data = json.loads(WORKFLOW_PATH.read_text(encoding="utf-8"))
    # `n8n import:workflow --input=<file>` expects a JSON array of workflows.
    assert isinstance(data, list), "import seed must be a JSON array of workflows"
    assert len(data) == 1, "expected exactly one workflow in the seed"
    return data[0]


@pytest.fixture(scope="module")
def nodes_by_name(workflow):
    return {n["name"]: n for n in workflow["nodes"]}


def test_workflow_identity(workflow):
    """Stable id + active flag — the init sidecar activates by id-bearing import."""
    assert workflow["id"] == "MyPropertyM58Inq"
    assert "Tenant inquiry" in workflow["name"]
    assert workflow.get("active") is True


def test_webhook_trigger(nodes_by_name):
    """POST /tenant-inquiry, answered by the Respond node (responseMode)."""
    wh = nodes_by_name["Webhook"]
    assert wh["type"] == "n8n-nodes-base.webhook"
    assert wh["parameters"]["httpMethod"] == "POST"
    assert wh["parameters"]["path"] == "tenant-inquiry"
    assert wh["parameters"]["responseMode"] == "responseNode"


def test_expected_node_set(nodes_by_name):
    """All eight pipeline nodes are present with the right types."""
    expected = {
        "Webhook": "n8n-nodes-base.webhook",
        "Prepare triage request": "n8n-nodes-base.code",
        "Anthropic configured?": "n8n-nodes-base.if",
        "Claude triage": "n8n-nodes-base.httpRequest",
        "Parse triage": "n8n-nodes-base.code",
        "Discord configured?": "n8n-nodes-base.if",
        "Post to Discord": "n8n-nodes-base.httpRequest",
        "Respond to caller": "n8n-nodes-base.respondToWebhook",
    }
    for name, node_type in expected.items():
        assert name in nodes_by_name, f"missing node: {name}"
        assert nodes_by_name[name]["type"] == node_type


def test_claude_node_targets_anthropic_with_env_key(nodes_by_name):
    """LLM call hits the Anthropic API, authenticated from the environment."""
    node = nodes_by_name["Claude triage"]
    p = node["parameters"]
    assert p["url"] == "https://api.anthropic.com/v1/messages"
    headers = {h["name"]: h["value"] for h in p["headerParameters"]["parameters"]}
    assert headers["x-api-key"] == "={{ $env.ANTHROPIC_API_KEY }}"
    assert headers["anthropic-version"] == "2023-06-01"
    # A failed LLM call must not break the webhook — it falls through to Parse.
    assert node.get("onError") == "continueRegularOutput"


def test_discord_node_uses_env_webhook_and_tolerates_failure(nodes_by_name):
    node = nodes_by_name["Post to Discord"]
    assert node["parameters"]["url"] == "={{ $env.DISCORD_WEBHOOK_URL }}"
    assert node.get("onError") == "continueRegularOutput"


def test_degradation_branches_gate_on_env(nodes_by_name):
    """Both IF nodes branch on the configured-ness flags the Code nodes compute."""
    anthropic_if = json.dumps(nodes_by_name["Anthropic configured?"]["parameters"])
    discord_if = json.dumps(nodes_by_name["Discord configured?"]["parameters"])
    assert "anthropicConfigured" in anthropic_if
    assert "discordConfigured" in discord_if


def test_code_nodes_implement_fallback_and_logging(nodes_by_name):
    prepare = nodes_by_name["Prepare triage request"]["parameters"]["jsCode"]
    parse = nodes_by_name["Parse triage"]["parameters"]["jsCode"]
    # Prepare reads both secrets from the environment.
    assert "$env.ANTHROPIC_API_KEY" in prepare
    assert "anthropicConfigured" in prepare
    # Parse falls back when the LLM is unavailable and always logs for Loki.
    assert "fallback" in parse
    assert "discordConfigured" in parse
    assert "[n8n][tenant-inquiry]" in parse
    assert "console.log" in parse


def test_graph_is_wired_end_to_end(workflow):
    """Follow the connections from the trigger to the response node."""
    conns = workflow["connections"]

    def targets(src):
        return [t["node"] for branch in conns.get(src, {}).get("main", []) for t in branch]

    assert targets("Webhook") == ["Prepare triage request"]
    assert targets("Prepare triage request") == ["Anthropic configured?"]
    # IF true-branch → Claude, false-branch → straight to Parse (skip the LLM).
    assert targets("Anthropic configured?") == ["Claude triage", "Parse triage"]
    assert targets("Claude triage") == ["Parse triage"]
    assert targets("Parse triage") == ["Discord configured?"]
    # IF true-branch → Discord, false-branch → straight to Respond.
    assert targets("Discord configured?") == ["Post to Discord", "Respond to caller"]
    assert targets("Post to Discord") == ["Respond to caller"]
