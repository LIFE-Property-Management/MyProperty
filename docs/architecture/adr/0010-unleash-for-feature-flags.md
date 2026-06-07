# ADR-0010: Self-hosted Unleash for feature flags (with a receipt-OCR kill-switch)

- **Status:** Accepted (M5.6, 2026-06)
- **Deciders:** Full Team
- **Reflected in:** [`containers.md`](../containers.md), [`components.md`](../components.md), [`data-flow.md`](../data-flow.md)

## Context

The receipt-OCR auto-extract path ([ADR-0005](./0005-anthropic-over-openai.md)) calls a paid third-party vision API (Anthropic) on every submitted receipt. M5.6 wanted a way to **turn that path off at runtime** — if the vendor key is rotated, costs spike, or the extraction misbehaves — **without a redeploy**. That is a feature-flag requirement, and once the capability exists it is the natural home for any future gradual-rollout / kill-switch need. We have no per-seat or per-MAU budget for a SaaS flag service.

## Decision

Self-host **Unleash OSS** (`unleashorg/unleash-server`) and integrate it behind an Application-layer port:

- **Port:** `IFeatureFlags` (`MyProperty.Application/Common/FeatureFlags/IFeatureFlags.cs`) — a single `Task<bool> IsEnabledAsync(string flag, bool defaultValue, CancellationToken)`. Call sites depend on this, not the SDK, keeping `Application` free of infrastructure references (same rule as `IBackgroundJobQueue`).
- **Adapters (Infrastructure):** `UnleashFeatureFlags` wraps the `Unleash.Client` SDK (a background poller keeps an in-memory snapshot, so evaluation is a local lookup — no per-request I/O); `NullFeatureFlags` is the no-op fallback. `AddFeatureFlags` registers `NullFeatureFlags` when no Unleash API token is configured, so the app stays healthy with flags inert when the backend is absent.
- **Server:** reuses the shared Postgres (a dedicated `unleash` database created by `infrastructure/postgres/init.sql`) — no new datastore. In dev, a `unleash-flag-init` one-shot sidecar seeds the first flag via the Admin API; in prod the client token comes from an optional `myproperty-unleash` Secret.
- **First flag:** `payments.ocr-autoextract` (`FeatureFlagKeys.OcrAutoExtract`). Checked in `PaymentSubmittedOcrConsumer` with `defaultValue: true`; when OFF, the consumer skips enqueuing `ReceiptOcrJob` and the payment stays manual-entry. The flag is **fail-open** — if Unleash is unreachable the default keeps OCR working.

## Consequences

### Positive

- **No recurring cost** — self-hosted OSS, no MAU/seat billing (consistent with the Keycloak self-host call, [ADR-0001](./0001-keycloak-over-custom-auth.md)).
- **Reuses existing Postgres** — one more logical database, not one more stateful service to operate.
- **Local snapshot evaluation** — flag checks are in-memory; no latency added to the request/consumer path.
- **Graceful degradation everywhere** — `NullFeatureFlags` when unconfigured, fail-open default when unreachable. A flag outage never takes the app down.
- **Decouples cost/vendor control from the deploy cycle** — the OCR kill-switch flips in the Unleash UI/API, not through a release.

### Negative

- **One more workload to run** (a single Unleash replica in `project-02`). The UI is **not** exposed via ingress in prod — flags are managed through the Admin API / seed script.
- **Shared-Postgres coupling** — Unleash availability is tied to the same Postgres as the app (acceptable; the app needs Postgres anyway).
- A second source of truth for behaviour (a flag) that readers must consult to know whether a path is live — mitigated by keeping the flag set tiny and documenting it in the data-flow diagram.

## Alternatives considered

- **LaunchDarkly / Flagsmith Cloud (SaaS)** — rejected on cost + vendor concentration for a school-budget demo.
- **Config-file / environment-variable flags** — rejected: flipping a flag would require a redeploy, which is exactly the constraint M5.6 set out to remove.
- **A homegrown flags table + admin endpoint** — rejected: re-implements Unleash's snapshot/SDK/UI for no saving, and `Unleash.Client` already exists.
