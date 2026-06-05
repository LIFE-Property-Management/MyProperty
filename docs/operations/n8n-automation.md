# n8n automation — tenant-inquiry triage (M5.8 / FS-8)

**Status:** ✅ Local complete & verified (2026-06-05) · cluster deploy deferred
**Deliverable:** M5.8 — "At least one webhook → LLM → notification automation pipeline"
**Requirement:** FS-8 — n8n automation (webhook → LLM → notification)

## Goal

Stand up an [n8n](https://n8n.io) automation that turns an inbound **tenant
inquiry** into a triaged, actionable Discord notification for the landlord:

```
HTTP webhook  →  Anthropic Claude triage  →  Discord notification
```

This is deliberately **distinct** from the M4.11 `aiops-webhook` (Alertmanager →
Claude → Discord), which triages *operational alerts* in Python. M5.8 owns a
*product* event and is built **visually in n8n** so it can be edited in the UI
without a code change or redeploy — demonstrating the low-code automation tool
the milestone calls for.

Scenario chosen (over "new property listing" and "payment event"): a tenant
sends a free-text message; Claude classifies it (category / urgency / sentiment),
writes a one-line summary and a drafted reply, and the landlord gets a Discord
card. It doubles as groundwork for M6.6 (customer-feedback analysis) and needs
no new backend entity, keeping M5.8 self-contained.

## What was built

| Artifact | Path |
|----------|------|
| Workflow definition (import seed) | `infrastructure/n8n/workflows/tenant-inquiry.json` |
| Service + one-shot seed sidecar | `docker-compose.yml` (`n8n`, `n8n-init`) |
| Sample payloads + service README | `infrastructure/n8n/samples/`, `infrastructure/n8n/README.md` |
| Structure-guard test + CI | `infrastructure/n8n/tests/test_workflow.py`, `.github/workflows/n8n-ci.yml` |
| Build helper (regenerates the JSON) | `infrastructure/n8n/_build_workflow.py` |

### The workflow (8 nodes)

```
Webhook (POST /tenant-inquiry, responseMode=responseNode)
  → Prepare triage request   Code: normalise the body, build the Claude request,
  →                                read $env.ANTHROPIC_API_KEY → anthropicConfigured
  → Anthropic configured?    IF $json.anthropicConfigured
        ├ true  → Claude triage   HTTP POST api.anthropic.com  (onError → continue)
        └ false ──────────────────┐
  → Parse triage             Code: parse Claude JSON or fall back; build the
  →                                Discord embed; console.log a structured line
  → Discord configured?      IF $json.discordConfigured
        ├ true  → Post to Discord HTTP POST $env.DISCORD_WEBHOOK_URL (onError → continue)
        └ false ──────────────────┐
  → Respond to caller        returns the triage JSON to the HTTP caller (200)
```

## Design decisions

- **Secrets via `$env`, not n8n credentials.** With
  `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`, nodes read `$env.ANTHROPIC_API_KEY` /
  `$env.DISCORD_WEBHOOK_URL` directly. This keeps the committed workflow plain,
  reviewable JSON with **no encrypted credential blob** tied to an instance
  encryption key — so the same file imports cleanly anywhere.
- **Provisioning via a one-shot sidecar**, mirroring `keycloak-realm-init`,
  `unleash-flag-init`, and `uptime-kuma-init`. `n8n-init` runs
  `import:workflow` + `update:workflow --all --active true` into the shared
  `n8n_data` volume and exits; the main `n8n` service gates on it
  (`service_completed_successfully`), so there's never concurrent SQLite access.
  `import` upserts by workflow id (`MyPropertyM58Inq`) → idempotent on re-up.
  (`import` also *deactivates*, which is why the explicit `--active true`
  follows.)
- **Graceful degradation, like the rest of the stack.** A fresh
  `docker compose up` with no API keys still runs the pipeline end-to-end:
  | Condition | Behaviour |
  |-----------|-----------|
  | `ANTHROPIC_API_KEY` empty | IF skips the LLM → manual-review fallback (`aiTriaged:false`). |
  | Claude errors (bad key/timeout/5xx) | HTTP `onError:continueRegularOutput` → same fallback. |
  | `DISCORD_WEBHOOK_URL` empty | IF skips the POST → `deliveredTo:"log"`. |
  | Discord POST errors | `onError:continueRegularOutput` → caller still gets `200`. |
- **Always-on log fallback.** `Parse triage` writes a structured
  `[n8n][tenant-inquiry] {…}` line; `CODE_ENABLE_STDOUT=true` surfaces it to the
  container stdout, which Promtail ships to Loki — visible in **Grafana →
  Explore → Loki** (`{container="myproperty-n8n"}`) even with Discord unset.
  (n8n suppresses Code-node `console.log` from stdout unless this flag is set —
  the reason the first verification pass saw no Loki line.)
- **Claude model:** Haiku 4.5 by default (`N8N_TENANT_INQUIRY_MODEL`) — triage is
  routine, latency-sensitive, and cheap; the same rationale as the aiops-webhook.

## Verification (local, 2026-06-05)

Exercised with the `n8nio/n8n:1.76.1` image; both graceful-degradation branches
and both happy-path branches were covered without a live Anthropic key by using
a fake key (to drive the `onError` path) and an HTTP echo container (to capture
the Discord POST body).

1. **No keys** → `POST /webhook/tenant-inquiry` returns `200`, `aiTriaged:false`,
   `recommendedAction` = "…unavailable (ANTHROPIC_API_KEY not set).",
   `deliveredTo:"log"`. ✓ (false/false branches)
2. **Fake `ANTHROPIC_API_KEY` + `DISCORD_WEBHOOK_URL`→echo** → `200`,
   `recommendedAction` = "…(Claude API call failed)." (proves the LLM branch ran
   and the `401` fell through `onError`), `deliveredTo:"discord"`; the echo
   container received a Discord-native `{content, embeds:[{title,color,
   description,fields}]}` body. ✓ (true/true branches + onError on both HTTP nodes)
3. **`CODE_ENABLE_STDOUT`** → the `[n8n][tenant-inquiry] {…}` line appears on n8n
   stdout (Promtail → Loki). ✓
4. **Idempotency** → re-importing the seed leaves exactly one workflow (upsert by
   id). ✓
5. **Real compose path** → `docker compose up -d n8n` runs `n8n-init` (exit 0),
   gates the main service on it, bind-mounts the seed, activates the workflow
   (`Start Active Workflows … => Started`), and serves the webhook with `200`. ✓
6. **Structure guard** → `pytest infrastructure/n8n/tests` — 8 passed.

## Demo

```bash
docker compose up -d n8n          # brings up n8n-init (seed) then n8n
curl -X POST http://localhost:5678/webhook/tenant-inquiry \
  -H 'Content-Type: application/json' \
  -d @infrastructure/n8n/samples/urgent-inquiry.json
# Editor UI (dev, no login): http://localhost:5678
```

## Configuration

See `.env.example` (n8n section). Key vars: `ANTHROPIC_API_KEY` (shared with
backend OCR + aiops-webhook), `DISCORD_WEBHOOK_URL` (shared with aiops-webhook),
`N8N_TENANT_INQUIRY_MODEL`, `N8N_ENCRYPTION_KEY` (must match between `n8n` and
`n8n-init`), `N8N_WEBHOOK_URL`.

## Deferred / known gaps

- **Cluster (Helm) deployment.** Intentionally **not** added. Cluster deploy is
  deferred project-wide pending the namespaced-Hetzner Helm rework (see
  [m5-auth-end-to-end.md](../milestones/m5-auth-end-to-end.md) → "Deferred"),
  and n8n on K8s needs decisions this milestone doesn't make: a `PersistentVolume`
  for the SQLite store (or switching n8n to the shared Postgres via `DB_TYPE=
  postgresdb`), and the import/activate as a Helm `Job` + `ANTHROPIC`/`DISCORD`
  `Secret`s. Shipping an untested manifest against a chart that itself needs
  rework would be liability, not progress — tracked for the cluster session.
- **Backend wiring.** The pipeline is self-contained (curl-triggered). Having the
  .NET API POST to `http://n8n:5678/webhook/tenant-inquiry` on a real inquiry
  event is a clean follow-up that touches no n8n-side code — the webhook contract
  is already stable.
- **Live happy-path.** The real Claude-success branch (structured JSON parsed
  into a Discord card) was validated by structure + the fallback/echo runs, not a
  live key. Set `ANTHROPIC_API_KEY` to see a real triage.
