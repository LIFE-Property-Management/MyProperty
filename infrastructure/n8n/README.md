# n8n automation — tenant-inquiry triage (M5.8 / FS-8)

A low-code **webhook → LLM → notification** pipeline built in
[n8n](https://n8n.io). When a tenant submits an inquiry, the workflow asks
Anthropic Claude to triage it (category, urgency, sentiment, a one-line summary
and a drafted reply) and posts the result to Discord for the landlord.

This is the n8n counterpart to the M4.11 `aiops-webhook` service: that one
triages **ops alerts** in Python; this one owns a **product event** and is built
visually so it can be edited in the n8n editor without a redeploy.

## Files

| Path | Purpose |
|------|---------|
| `workflows/tenant-inquiry.json` | The workflow export, imported + activated on boot. |
| `samples/*.json` | Example webhook payloads for the demo / smoke test. |
| `tests/test_workflow.py` | Structure guard — asserts the workflow's invariants. |
| `_build_workflow.py` | Build helper that regenerates `workflows/tenant-inquiry.json` (the Code-node JS is authored as Python strings, then dumped to JSON). Not a runtime artifact. |

## The workflow

```
Webhook (POST /tenant-inquiry)
  → Prepare triage request        (Code: normalise body, build the Claude request)
  → Anthropic configured?         (IF on $env.ANTHROPIC_API_KEY)
        ├─ true  → Claude triage  (HTTP POST api.anthropic.com, onError → continue)
        └─ false ─────────────────┐
  → Parse triage                  (Code: parse JSON / fall back; build Discord embed; log)
  → Discord configured?           (IF on $env.DISCORD_WEBHOOK_URL)
        ├─ true  → Post to Discord (HTTP POST webhook, onError → continue)
        └─ false ─────────────────┐
  → Respond to caller             (returns the triage JSON to the HTTP caller)
```

Secrets are read straight from the process environment via `$env.*` (with
`N8N_BLOCK_ENV_ACCESS_IN_NODE=false`), so there is **no encrypted n8n credential
to manage** and the import seed stays plain, reviewable JSON.

## Graceful degradation

The pipeline runs on a fresh `docker compose up` with no external accounts:

| Condition | Behaviour |
|-----------|-----------|
| `ANTHROPIC_API_KEY` empty | "Anthropic configured?" routes around the LLM; `Parse triage` returns a manual-review fallback (`aiTriaged: false`). |
| Claude call errors (bad key, timeout, 5xx) | The HTTP node's `onError: continueRegularOutput` flows to `Parse triage`, which falls back the same way. |
| `DISCORD_WEBHOOK_URL` empty | "Discord configured?" skips the POST (`deliveredTo: "log"`). |
| Discord POST errors | `onError: continueRegularOutput` — the caller still gets a `200`. |

Either way, `Parse triage` always writes a structured `[n8n][tenant-inquiry] …`
line to stdout (`CODE_ENABLE_STDOUT=true`). Promtail ships it to Loki, so every
triage is visible in **Grafana → Explore → Loki** (`{container="myproperty-n8n"}`)
even when Discord is not configured.

## Provisioning

The workflow is **not** committed into n8n's database — it is imported on boot
by the one-shot `n8n-init` sidecar (see `docker-compose.yml`), which runs
`n8n import:workflow` + `n8n update:workflow --all --active true` against the
shared `n8n_data` volume, then exits. The main `n8n` service gates on it with
`depends_on … service_completed_successfully`, so there is never concurrent
SQLite access. Import upserts by workflow id, so re-running `docker compose up`
is idempotent (no duplicates).

> Because the file is the source of truth, editing the workflow in the n8n UI
> and then re-running `docker compose up` will re-import and **overwrite** the UI
> edits. To persist a UI change, re-export it over `workflows/tenant-inquiry.json`
> (`n8n export:workflow --id=MyPropertyM58Inq --output=…`) or edit
> `_build_workflow.py` and regenerate.

## Demo

```bash
# Routine inquiry
curl -X POST http://localhost:5678/webhook/tenant-inquiry \
  -H 'Content-Type: application/json' \
  -d @infrastructure/n8n/samples/tenant-inquiry.json

# Urgent inquiry (no heating, infant at home)
curl -X POST http://localhost:5678/webhook/tenant-inquiry \
  -H 'Content-Type: application/json' \
  -d @infrastructure/n8n/samples/urgent-inquiry.json
```

Each call returns `200` with the triage result:

```json
{ "received": true, "aiTriaged": true, "category": "maintenance",
  "urgency": "high", "sentiment": "frustrated", "summary": "…",
  "suggestedReply": "…", "recommendedAction": "…", "deliveredTo": "discord" }
```

Open the editor (dev mode skips login) at <http://localhost:5678> to watch
executions on the canvas.

## Configuration

All optional — see `.env.example` for the full list:

| Variable | Default | Notes |
|----------|---------|-------|
| `ANTHROPIC_API_KEY` | _(empty)_ | Same key as backend OCR / aiops-webhook. Empty → fallback triage. |
| `DISCORD_WEBHOOK_URL` | _(empty)_ | Empty → log-only delivery. |
| `N8N_TENANT_INQUIRY_MODEL` | `claude-haiku-4-5-20251001` | Claude model for triage. |
| `N8N_ENCRYPTION_KEY` | dev placeholder | Must match between `n8n` and `n8n-init`. Set a real secret when deployed. |
| `N8N_WEBHOOK_URL` | `http://localhost:5678/` | Base URL n8n advertises for webhooks. |
