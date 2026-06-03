# Feature flags (Unleash) — M5.6

Self-hosted **Unleash** (OSS) provides runtime feature toggles. M5.6 ships one
real toggle: a **kill-switch on the receipt-OCR pipeline**.

## What & why

- **Tool:** Unleash OSS, self-hosted — fits the all-self-hosted stack (Keycloak,
  Grafana, RabbitMQ); no external SaaS. Server image
  `unleashorg/unleash-server:7.6.4`; .NET SDK `Unleash.Client`.
- **The flag:** `payments.ocr-autoextract` (type *kill-switch*). **ON** (default) →
  a submitted receipt is sent to the Anthropic vision API for OCR auto-extraction.
  **OFF** → the OCR job is not enqueued; the payment keeps its null `Ocr*` fields —
  the same manual-entry state as a no-receipt submission. Nothing downstream
  breaks; the landlord still reviews the tenant-entered amount.
- **Why this feature:** OCR is a *paid external API* call with a clean, safe
  fallback. A cost/incident kill-switch is the most defensible real use of a flag.

## Architecture

- **Abstraction:** `IFeatureFlags` (`MyProperty.Application/Common/FeatureFlags`) —
  `Task<bool> IsEnabledAsync(flag, defaultValue, ct)`. Call sites depend on this,
  never on the SDK (Clean Architecture dependency rule). Keys live in
  `FeatureFlagKeys`.
- **Implementations** (`MyProperty.Infrastructure/FeatureFlags`):
  - `UnleashFeatureFlags` — wraps a singleton `IUnleash`. `IsEnabled` is an
    in-memory snapshot read (a background poller refreshes every
    `FetchTogglesIntervalSeconds`, default 15s — no per-call I/O). Never throws:
    on error it logs a warning and returns the caller's default (mirrors
    `RedisLandlordDashboardCache`'s graceful degradation).
  - `NullFeatureFlags` — used when no API token is configured; returns the caller
    default for every flag. Parallels `NullEventPublisher` on the messaging side.
- **Registration:** `DependencyInjection.AddFeatureFlags` — empty token →
  `NullFeatureFlags`; token present → live `IUnleash` + `UnleashFeatureFlags`.
  Mirrors `AddCaching` / `AddMessaging`.
- **Flag-check site:** `PaymentSubmittedOcrConsumer.HandleAsync` resolves
  `IFeatureFlags` from the per-message scope and gates `EnqueueReceiptOcr`.
- **Default value `true` (fail-open).** OCR runs unconditionally today; if Unleash
  is unreachable the SDK serves its last-known / supplied default, and a *shipped*
  feature should keep working. The flag is an intentional human-flipped
  kill-switch, not a fail-closed gate. To make a flag fail-closed, pass
  `defaultValue: false` at its call site.

## Configuration matrix

| Setting | `appsettings.json` | `appsettings.Development.json` | compose (backend) | Helm (prod) |
|---|---|---|---|---|
| `Unleash:ApiUrl` | `""` (placeholder) | `http://localhost:4242/api/` | `http://unleash:4242/api/` | `http://unleash:4242/api/` |
| `Unleash:ApiToken` | `""` | seeded dev token | seeded dev token | Secret `myproperty-unleash/client-api-token` (optional) |
| `Unleash:AppName` | `myproperty-api` | — | — | — |
| `Unleash:FetchTogglesIntervalSeconds` | `15` | — | — | — |

Empty `ApiToken` ⇒ `NullFeatureFlags` (flags inert, app healthy). The dev token
must equal the Unleash server's `INIT_CLIENT_API_TOKENS`. Empty placeholders in
`appsettings.json` are always overridden per-environment — same contract as the
existing `Cache` / `Keycloak` sections.

## Local dev (docker compose)

The stack runs a self-hosted `unleash` server (reusing Postgres via a dedicated
`unleash` database) plus a one-shot `unleash-flag-init` sidecar that creates and
enables the flag via the Admin API on first boot.

Toggle round-trip:

1. `docker compose up -d`. (On a pre-existing `postgres_data` volume the `unleash`
   database won't exist yet — create it once with
   `docker compose exec postgres psql -U postgres -c "CREATE DATABASE unleash;"`
   then `docker compose up -d unleash unleash-flag-init`.)
2. Unleash UI: `http://localhost:4242` (first-run admin `admin` / `unleash4all`).
   Confirm `payments.ocr-autoextract` exists and is **ON** in `development`.
3. **Flag ON:** submit a payment with a receipt
   (`POST /api/v1/payments/{id}/submit`, multipart). A `ReceiptOcrJob` runs —
   visible in the Hangfire dashboard at `http://localhost:5042/hangfire`.
4. Toggle the flag **OFF** in the UI; wait ≤15s (SDK refresh). Submit another
   receipt payment → **no** new `ReceiptOcrJob`; the consumer logs the
   manual-entry fallback; the payment persists with null `Ocr*` fields.
5. Toggle back **ON** → OCR resumes. (runtime kill-switch round-trip)
6. **Graceful degradation:** `docker compose stop unleash`, submit a receipt →
   submission still succeeds and OCR continues (default `true`), no exceptions.

### Reproducible seeding

- **Client token:** the `unleash` service seeds a fixed token via
  `INIT_CLIENT_API_TOKENS=default:development.unleash-insecure-api-token`
  (dev/CI only — never in a deployed environment).
- **The flag:** `infrastructure/unleash/seed-flags.sh` (run by the
  `unleash-flag-init` sidecar) creates the flag, adds a default strategy, and
  enables it in `development` via the Admin API. Idempotent and fully
  failure-tolerant — if Unleash can't be reached it logs and exits 0, and the
  flag can be created in the UI instead.

> An Unleash `IMPORT_FILE` state-export was considered for seeding but its schema
> is version-specific; the Admin-API sidecar is robust across server versions and
> matches the repo's existing one-shot init pattern (`keycloak-realm-init`).

## Production (Helm)

- `unleash.enabled: true` renders an in-cluster `unleash` Deployment + Service
  (`templates/data/unleash-*.yaml`), reusing the in-cluster Postgres `unleash`
  database (created by `files/postgres-init.sh`) with the app Postgres
  credentials. `DATABASE_SSL=false` is correct for in-cluster Postgres.
- **Client token** lives in the `myproperty-unleash` Secret, key
  `client-api-token`. Both the Unleash server (`INIT_CLIENT_API_TOKENS`) and the
  backend (`Unleash__ApiToken`) read it, so they agree. Both references are
  **`optional: true`**: if the Secret is absent, the server starts with no seeded
  token and the backend falls back to `NullFeatureFlags` — the deploy is
  non-breaking. Provide the Secret (and create the flag) when ready to use flags.
  - **External Secrets enabled:** the `myproperty-unleash` ExternalSecret syncs
    `unleashClientApiToken` from the configured backend.
  - **ESO disabled (default):**
    `kubectl -n <ns> create secret generic myproperty-unleash --from-literal=client-api-token='default:production.<secret>'`.
- Create the flag once via the Unleash UI (or replay the Admin-API seed) and
  change the default admin password.
- **NetworkPolicies:** when enabled, add allow rules `backend → unleash:4242` and
  `unleash → postgres:5432` (the default-deny baseline blocks them otherwise).

## Follow-ups

- **Frontend UI toggle** via Unleash Edge/Proxy + `@unleash/proxy-client-react` to
  gate a UI element. One backend toggle satisfies M5.6; this is additive.
- **More flags** — add keys to `FeatureFlagKeys`; the abstraction and DI scale
  unchanged.
- **Per-flag fail-closed** — pass `defaultValue: false` where a flag should default
  off if Unleash is unreachable.
- **Harden the Unleash pod** — `readOnlyRootFilesystem: true` + a tmpfs `/tmp`
  `emptyDir`.
- **Managed Postgres** — set `DATABASE_SSL=true` (+ CA) on the Unleash deployment;
  the chart's in-cluster default is `false`.
