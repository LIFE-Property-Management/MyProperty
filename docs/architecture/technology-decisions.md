# Technology decisions — the story

This document walks through *why* the platform looks the way it does, in roughly the order the decisions were made. It is the connective tissue between the C4 diagrams (what runs) and the ADRs (the formal record of each load-bearing call). Read this first if you want the high-level story; read the ADRs next if you want the trade-offs in detail.

Every entry here justifies a decision by its **architectural and technical merit**, not by "a milestone asked for it." Where a requirement first surfaced a need, that's noted as context — but the reason a thing is the way it is, is always the engineering reason.

## The problem

MyProperty is a **multi-tenant property-management SaaS**. Two end-user roles — *Tenant* and *Landlord* — share most of the surface and diverge in two portals (`/tenant/dashboard` for tenants; `/dashboard` for landlords). A third role, *Admin*, operates the Hangfire dashboard and the Keycloak realm. Tenants pay rent and upload receipts; landlords manage properties, leases, payments, and approve or reject submitted payments. The end-to-end flow that exercises the most moving parts is *landlord confirms a payment* — a synchronous REST call that triggers an asynchronous email + real-time push to the tenant. That flow is the spine of the system; most architectural choices serve it.

The shape of the platform is driven by a handful of genuine needs, each of which forces a technology decision:

- **Federated SSO + role-based access** — users sign in with Google or email/password, and the same identity must gate both portals and the API. This wants a real identity provider, not bespoke auth.
- **Live UI updates** — a landlord confirming a payment should reach the tenant without a manual refresh. This wants a server-push channel plus a refetch-on-signal client model.
- **Durable, retryable side effects** — email delivery and receipt OCR must survive a process restart and tolerate transient failure. This wants a persistent background-job runner and an event broker that decouples the request from its side effects.
- **An AI feature that earns its place** — not AI for its own sake, but extraction that removes manual data entry.
- **Operability on a cost-bounded cluster** — structured logs, metrics, alerts, and external probes without a heavyweight observability stack.
- **A supply-chain-aware delivery pipeline** — every image scanned for CVEs and accompanied by an SBOM before it can deploy.

The deliberate non-goals were RAG/pgvector (no domain use case for vector search), MediatR (paid license + indirection we don't need), and AutoMapper (DTO mapping is hand-rolled today; Mapperly source-gen is the planned retrofit). Each of those omissions is justified inline at the point it would otherwise appear.

## Why Clean Architecture, and why one .NET process

The backend ships as four .NET 10 projects in strict layering — `Api → Application → Domain` plus `Infrastructure → Application` — enforced by project references. *No* EF Core or ASP.NET types are allowed in `Application` or `Domain`. Interfaces in `Application` (e.g., `IPaymentRepository`, `INotificationDispatcher`, `IEmailSender`, `IReceiptOcrService`, `IFileStorage`, `IBackgroundJobQueue`, `IFeatureFlags`) are the ports; implementations in `Infrastructure` (and, for the SignalR dispatcher, in `Api`) are the adapters. The handlers in `Application` never know which adapter is wired in, which is what makes the test fixture able to swap `IDistributedCache` for `MemoryDistributedCache` and `IBackgroundJobQueue` for a recording fake without touching production code.

The three roles inside the .NET process — REST API, SignalR `NotificationsHub`, Hangfire job server — all run in the same OS process. C4 calls this *one container*; the only reason to split it would be to scale the OCR worker independently of the request-serving pods, and at MVP scale that's not warranted. When it is, the split is a deployment change, not a code change.

## Why a single `User` aggregate, with the role in Keycloak

There is no `Tenant` entity and no `Landlord` entity. There is one `User` aggregate, and the Tenant-vs-Landlord distinction is a **Keycloak realm role** carried on the JWT. This is deliberate: a person could in principle be both a landlord and a tenant, identity and credentials are owned by the IdP (not the app database), and authorization is enforced from the `realm_access.roles` claim rather than a column the app could drift out of sync. The repository surface follows the model — one `IUserRepository`, not a `Tenant`/`Landlord` split — and the domain stays a thin relational model (`User`, `Property`, `Lease`, `Invite`, `Payment`, `FailedEmail`). Role logic lives at the edge (policies + `[Authorize]`), not in the entity graph.

## Why PostgreSQL

The domain is relational — properties own units, leases bind a landlord/tenant/property, payments belong to leases, invites mint leases — with hard foreign-key integrity and an atomic unit of work that matters (accepting an invite creates a lease **and** marks the invite accepted in one `SaveChangesAsync`). That's a transactional, ACID, relational workload, not a document or key-value one. Postgres also lets the *whole stack* speak one engine: a single Postgres instance backs the **application database** (which also hosts Hangfire's own tables), plus a separate **`keycloak`** database and a separate **`unleash`** database created by the init script — three logical databases, one stateful service to operate instead of three. Npgsql + EF Core 10 is a mature, first-class .NET path, and `jsonb` is on hand for the OCR raw-response column without reaching for a second store. The data-model rationale (keys, soft-delete, indexing, normalization) is in [`../database/README.md`](../database/README.md).

## Why EF Core, and migrations as a pre-upgrade Job

EF Core earns its place precisely because we *want* change-tracking and interception: the `AuditingInterceptor` populates `CreatedAt/UpdatedAt/CreatedBy/UpdatedBy` on save, and a global query filter appends `WHERE DeletedAt IS NULL` to every query so soft-delete can't be bypassed by a forgetful handler. Per-aggregate `IEntityTypeConfiguration` classes keep the mapping declarative. A thin micro-ORM (Dapper) would push all of that — auditing, soft-delete, change tracking — back into hand-written SQL on every call site.

Schema changes ship as a **self-contained EF migration bundle** run as a Helm **pre-upgrade Job**, not via `Database.Migrate()` at app startup. In a rolling deploy, several new pods start at once; if each called `Migrate()` they'd race on the migration lock and some could serve traffic against a half-migrated schema. A single pre-upgrade Job eliminates the race. Migrations are **forward-only** — the sharpest deploy-time risk, called out in [`deployment-prod.md`](./deployment-prod.md) and [`../operations/migrations.md`](../operations/migrations.md).

## Why Keycloak, and the cost of self-hosting an IdP

We need federated Google sign-in, a hosted password-reset flow, refresh-token rotation, a JWKS endpoint to validate tokens against, an admin console, and RBAC — the full surface of an identity provider. Building that on custom JWT issuance + ASP.NET Identity means re-implementing Google IdP brokering, password-reset email flows, refresh-token rotation, and JWKS rotation *badly*, and owning the security bugs forever. Auth0 / Okta solve it but bill per-MAU, which a continuously-running demo can't absorb. Self-hosting Keycloak gives a **real** IdP we control, version its realm in `realm-export.template.json`, and — crucially — test against the genuine article (the integration fixture spins up a real Keycloak Testcontainer per run, so we test what we deploy). [ADR-0001](./adr/0001-keycloak-over-custom-auth.md) records the call.

The price is one more stateful service. Keycloak's Quarkus distribution boots in ~10 s; the 5-minute cost of inline-Java healthchecks (Keycloak 26's UBI Micro base ships no curl) is paid back the first time a deploy needs to reproduce.

## Why RabbitMQ, and why direct `RabbitMQ.Client`

Event volume is tens per minute, not millions per second. AMQP topic routing (`{aggregate}.{verb}`, derived automatically from event type names) maps cleanly to domain semantics; fan-out — already used for `payment.submitted` → both SignalR push and Hangfire OCR enqueue — is one extra binding, not a code change. Kafka would be designed-for-replay infrastructure for a workload that doesn't need replay. [ADR-0002](./adr/0002-rabbitmq-over-kafka.md) records the call.

MassTransit is the obvious "abstract over RabbitMQ" library; we declined it. With five consumers that all subclass a single `IntegrationEventConsumerBase`, the abstraction would be larger than the thing it abstracts.

## Why Hangfire, and why in-process

Durable, retryable background work — email that must not silently drop, OCR that must survive a restart — wants a persistent job store with retry and a dead-letter path. Hangfire fits exactly: it uses the Postgres we already run (no new infrastructure), gives a web dashboard for free, and runs in-process so jobs share the same `IServiceScope` as the request handlers. The two ad-hoc jobs (`SendEmailJob` with retry-and-DLQ, `ReceiptOcrJob`) plus **three recurring scans** scheduled via `RecurringJob.AddOrUpdate` — `MarkExpiredInvitesJob` (hourly), `OrphanCleanupJob` (daily 03:00 UTC), and `LeaseExpiringSoonJob` (daily 08:00 UTC) — map onto its surface directly. (A mark-overdue-payments scan is the one remaining `backend/CLAUDE.md` follow-up; the lease-expiring scan runs but publishes no integration event, so it triggers no SignalR push yet.) [ADR-0003](./adr/0003-hangfire-over-temporal.md) records the call. Temporal would buy workflow orchestration we don't need; Quartz lacks a dashboard.

## Why the events + signals pattern

Every business action that has user-visible side effects follows the same shape:

1. The HTTP handler mutates state synchronously inside one unit of work and commits.
2. The handler publishes an integration event **after** the DB commit.
3. RabbitMQ consumers translate the event into side effects: durable retryable work goes to Hangfire (email, OCR); instant UX feedback goes to SignalR.

This means the request response returns fast (no waiting on Anthropic or SMTP), email delivery is durable (Hangfire retries + DLQ), and the UI can feel live (SignalR push invalidates a TanStack query → refetch). The handler's commit-then-publish ordering leaves a small race window where the commit succeeds and the publish fails — acceptable here because consumers are idempotent, and the outbox pattern is a clean follow-up if exactly-once semantics ever become a requirement.

## Why SignalR delivers signals, not state

The frontend treats TanStack Query as the source of truth for data. SignalR delivers **signals** — `{ paymentId, confirmedAt }` payloads that cause `queryClient.invalidateQueries(...)` to refetch authoritative state from the API. The hub is server-push only; clients have no callable methods. The Redis backplane fans out across backend replicas (configured but unused today, since `replicas: 1` in prod for unrelated PVC reasons). If a push is dropped, the next page navigation fetches authoritative data — no UX correctness depends on push reliability.

The frontend `@microsoft/signalr` client is **not yet wired**. The server-side hub, the backplane, the dispatcher abstraction, and the RabbitMQ consumer that triggers pushes all exist; what's missing is the browser-side connection. This is called out honestly in [`containers.md`](./containers.md) and [`data-flow.md`](./data-flow.md) — the diagrams should not lie about the system's state.

## Why Redis backs both the cache and the backplane

Two needs, one in-memory store. The landlord dashboard query is cache-aside on Redis (`IDistributedCache`, 60 s TTL, invalidated on payment writes) so the most-loaded read doesn't hammer Postgres; and SignalR's scale-out requires a backplane so a push from any replica reaches a client connected to any other. Both are textbook Redis, both speak the canonical `StackExchange.Redis` client, and running one Redis covers them — no second technology to operate for the backplane.

## Why Anthropic — and why receipt OCR instead of RAG

[ADR-0005](./adr/0005-anthropic-over-openai.md) records two related decisions. First, we substituted *receipt OCR* for a *RAG + pgvector* deliverable: the domain has no genuine semantic-search use case (entities are relational and well-served by SQL), while receipt OCR is a real UX improvement that pre-fills the payment-submission form. The substitution itself is the deliverable.

Second, Anthropic Claude over OpenAI / Vertex. Sonnet (`claude-sonnet-4-5-20250929`) for receipt OCR (vision quality on structured documents, parseable JSON output, ~30 s budget); Haiku (`claude-haiku-4-5-20251001`) for AIOps alert triage (cheap enough that chatty alerts don't burn budget, fast enough that triage feels responsive). One vendor, one API key per environment, one billing dashboard. **Note the integration shape differs by surface:** the .NET `AnthropicReceiptOcrService` calls the Messages API over a hand-rolled `HttpClient` (no .NET SDK dependency — the surface is one POST), while the Python AIOps webhook uses the official `anthropic` SDK. The vendor-concentration risk is real and accepted — both surfaces degrade gracefully (the AIOps webhook posts raw labels to Discord if `ANTHROPIC_API_KEY` is empty; receipt OCR returns an empty result and the user fills the form by hand).

## Why a feature flag guards the receipt OCR

The OCR path is the one place the system spends money per request on a third-party vendor. We needed a runtime **kill-switch** for that path — to turn it off without a redeploy if the key is rotated, costs spike, or extraction misbehaves. A redeploy is exactly the wrong tool for "stop spending money right now," so config-file flags (which need a restart) were out; that's the genuine reason a feature-flag service exists at all here. We self-host **Unleash** rather than pay a SaaS per-seat: it reuses the Postgres we already run (a dedicated `unleash` database), and the backend depends on an Application-layer `IFeatureFlags` port (not the SDK) so the abstraction stays where the other ports live. `payments.ocr-autoextract` is checked in `PaymentSubmittedOcrConsumer` with a **fail-open** default — if Unleash is unreachable, OCR still runs; if the flag is deliberately off, submitted receipts stay manual-entry and no Anthropic call is made. [ADR-0010](./adr/0010-unleash-for-feature-flags.md) records the call.

## Why structured logging to stdout, scraped by Promtail — not a direct Loki sink

The .NET backend emits structured logs as **CLEF JSON to stdout** (Serilog's console sink with `CompactJsonFormatter`, enriched with `CorrelationId`, scopes, and full exception chains). It does **not** push to Loki directly — there is no `Serilog.Sinks.Grafana.Loki` in the build. That is a deliberate choice: writing to stdout keeps the app decoupled from the log backend (the API doesn't know or care that Loki exists), keeps `docker logs` / `kubectl logs` useful for local and incident debugging, and means **one uniform ingestion path** — Promtail tails every container's stdout (the API included) and ships to Loki. An in-app Loki sink would special-case the API, couple deploys to the log backend's availability, and duplicate what Promtail already does for everything else.

The Loki-vs-ELK choice itself is in [ADR-0007](./adr/0007-loki-over-elk.md): Loki's label-based indexing keeps its memory floor at ~256 MiB request, vs Elasticsearch's ~1–2 GiB JVM heap floor — and on a cost-bounded node pool, that matters. The sacrifice is slower full-text search across all containers; labelled queries (`{container="myproperty-api"} | json | level="Error"`) are comparable. The bigger win is **one UI**: we already need Grafana for metrics (and Alertmanager state), and Grafana's Loki datasource puts logs in the same Explore view, so there's no second tool to context-switch into.

## Why prometheus-net over OpenTelemetry

The API exposes `/metrics` via `prometheus-net.AspNetCore`. The deciding factor is metric-name compatibility: prometheus-net emits the community-standard names (`http_requests_received_total`, `http_request_duration_seconds_bucket`, `process_working_set_bytes`, …) that every off-the-shelf Grafana dashboard and PromQL example expects. OpenTelemetry's `http.server.*` semantic-convention names would have forced bespoke dashboards built from scratch. OTel's real advantage is distributed tracing — and we have no spans in scope yet (see "what we deliberately did not do"), so the trade favours the simpler, dashboard-compatible exporter.

## Why a shared Hetzner cluster (project-02) for prod

Production *originally* ran on DigitalOcean DOKS ([ADR-0004](./adr/0004-doks-over-gke-eks.md), now superseded). We moved onto a **namespace (`project-02`) on a shared Hetzner cluster** that Gjirafa operates — free to us, where DOKS billed for nodes + managed Postgres + Spaces for a continuously-running demo. [ADR-0009](./adr/0009-hetzner-project-02-over-doks.md) records the move.

The one constraint that shapes everything is **namespace-admin only** — no cluster-scoped permissions. That single fact is why prod has *no* Terraform (nothing to provision for a borrowed namespace), *no* Prometheus Operator (the `kube-prometheus-stack` dependency was replaced with self-contained Prometheus/Alertmanager/Grafana manifests, since CRDs are cluster-scoped), a namespaced cert-manager `Issuer` instead of a `ClusterIssuer`, manual K8s Secrets instead of an External Secrets Operator, a namespaced-`Role` Promtail instead of a cluster-wide DaemonSet, and push-based CD instead of GitOps. Every stateful service — Postgres, Redis, RabbitMQ, Keycloak, Unleash — is self-hosted in the namespace on Longhorn PVCs; the CNI is Calico, so `NetworkPolicy` enforcement (default-deny + targeted allows, on in prod) works without extra wiring. The DO Managed Postgres + S3 Spaces conveniences went away with DOKS — receipts now live on a PVC via `LocalFileStorage`, and a Spaces/S3 adapter is a follow-up. For the demo budget, a free namespace beats a cheap-but-paid cluster.

## Why distroless / chiseled, non-root, digest-pinned images

Every runtime image is hardened for the same reason: shrink the attack surface and the blast radius of a CVE. The backend runs on a **chiseled** Ubuntu base (UID 1654) with no shell, no package manager, and no userspace tools — so a foothold has almost nothing to pivot with. The frontend runs the Next.js standalone bundle on a **distroless** Node base (image nonroot UID 65532; the pod's `securityContext` further pins `runAsUser: 1000`); the AIOps webhook runs as a dedicated non-root user. Bases are **digest-pinned** (`@sha256:`) so a rebuild can't silently pull a different upstream. This pairs with the supply-chain gates below — Trivy CRITICAL-blocking + a CycloneDX SBOM per image — so "what's in this image, and is it non-root" both have answers.

## Why Next.js App Router for the frontend

[ADR-0006](./adr/0006-nextjs-app-router-over-remix.md) records the choice, justified against Remix and SvelteKit on ecosystem maturity. Every supporting library we needed (TanStack Query, React Hook Form, Zod, keycloak-js, Framer Motion, MSW, Playwright) integrates with the App Router + React Server Components out of the box, and the standalone production build (`output: 'standalone'`) compresses well into a distroless Node image (~90% smaller than the default node base).

[ADR-0008](./adr/0008-tanstack-query-over-swr.md) records the TanStack Query + Zustand split: TanStack Query owns *server* state (the cache that SignalR will invalidate), Zustand owns *client* state (the decoded auth identity). The query-key hierarchy in `lib/hooks/queryKeys.ts` plus ~20 typed hooks makes the eventual SignalR integration mechanical: a future hub handler will be one `queryClient.invalidateQueries(...)` away.

## Why n8n for the tenant-inquiry automation

A free-text tenant inquiry needs to be classified and surfaced to a landlord. Building that as another .NET endpoint would couple a fuzzy, likely-to-change product flow to the API's release cycle. Instead it's an 8-node **n8n** workflow (webhook → Claude Haiku → Discord) — visual, low-code, editable without a redeploy, and isolated from the API process. It degrades gracefully (no AI key → manual-review fallback; no Discord URL → stdout, which Promtail ships to Loki). The cluster deploy is deliberately **deferred**: an open n8n editor is effectively arbitrary-JavaScript RCE, so the Helm deploy must first drop `N8N_USER_MANAGEMENT_DISABLED`, keep the editor off the public ingress, and source the encryption key from a Secret. Full doc: [`../operations/n8n-automation.md`](../operations/n8n-automation.md).

## Why PostHog over GA4 for product analytics

The product's core artifact is a **conversion funnel** (visit → signup → property → invite → active lease), and the next analytics step is an A/B test. PostHog treats funnels/paths/retention as first-class and ships experiments from the same install; GA4 is acquisition-oriented, samples funnel data, and would need extra tooling for experiments. PostHog also offers EU-cloud hosting (tenant PII residency), which fits the same self-host-friendly posture as Keycloak/Grafana/Loki. The integration mirrors the `WebVitalsReporter` pattern: a thin, env-driven facade in `lib/analytics` that is a **no-op without a key**, so tests, CI, security scans, and key-less local dev all run with analytics cleanly off. Only `posthog.ts` imports the SDK; everything else calls the typed facade.

## Why CI/CD looks the way it does

**Eight** GitHub Actions workflows. Four are image-building CI that feed CD — `backend-ci.yml` (builds `myproperty-api` + `myproperty-migrations`), `frontend-ci.yml`, `aiops-webhook-ci.yml`, `uptime-kuma-init-ci.yml`. Three are CI that build **no** image (and so don't trigger CD) — `realm-import-ci.yml` (smoke-tests the Keycloak realm), `n8n-ci.yml` (validates the tenant-inquiry workflow), and `security-ci.yml` (gitleaks/git-secrets + Lighthouse + OWASP ZAP DAST on a schedule). One is CD — `cd.yml`. Each image-building workflow builds the image, scans it twice with Trivy (SARIF non-blocking for HIGH+CRITICAL, gate blocking for CRITICAL only), generates a CycloneDX SBOM, and pushes to GHCR — the three code workflows (backend, frontend, aiops-webhook) lint and test first, while `uptime-kuma-init` is build-and-scan only and the `myproperty-migrations` bundle rides `backend-ci` without its own scan.

Backend CI runs the **full** `dotnet test` suite — the Testcontainers-backed integration tests are *not* excluded; they spin up real Postgres + Keycloak on the runner and gate the build alongside the unit tests.

CD is **push-based** and namespace-scoped — GitOps (ArgoCD/Flux) is impossible because the service account is namespace-admin only. `cd.yml` fires on `workflow_run` after the four image-CI workflows finish on `develop`/`main`, behind the protected `project-02` Environment (manual approval). It resolves which component images exist at the triggering SHA, bumps the matching tags in `values-gjirafa.yaml` (a byte-perfect `ruamel` edit, pushed by a GitHub App that's on the branch-ruleset bypass list), then runs `infrastructure/gjirafa/deploy.sh --atomic` — the same script as a manual deploy. The `--atomic` flag rolls a failed deploy's *workloads* back to the previous release. EF Core migrations run as a pre-upgrade Helm Hook but are **forward-only**, so a failed deploy can leave the DB partly migrated — verified manually, not auto-rolled-back. [`cicd.md`](./cicd.md) has the full pipeline; [ADR-0009](./adr/0009-hetzner-project-02-over-doks.md) the platform move.

Postgres is **self-hosted in both dev and prod** now (`postgres.enabled: true` in `values-gjirafa.yaml`) — the old `--set postgres.enabled=false` swap to DO Managed PostgreSQL went away with DOKS.

## What we deliberately did not do

A faithful architecture document names its omissions. The list:

- **No RAG / pgvector.** Substituted with receipt OCR. Reason: no semantic-search use case in the domain.
- **No MediatR.** CQRS folder structure used directly; controllers inject handlers and call `Handle(...)`. Reason: MediatR moved to a paid license in 2024 and we don't need pipeline behaviours.
- **No AutoMapper.** Entity ↔ DTO mapping is hand-rolled in each handler today; a Mapperly source-generator retrofit is a documented post-M3 follow-up. Reason: reflection-free, build-time errors, faster — and AutoMapper's runtime reflection model is exactly what we want to avoid.
- **No MassTransit.** Direct `RabbitMQ.Client` for five consumers. Reason: abstraction overhead exceeds the thing it abstracts.
- **No generic `IRepository<T>`.** One repository per aggregate, methods named for use cases. Reason: generic repositories leak `IQueryable` and defeat the purpose.
- **No `GetSignedUrlAsync` on `IFileStorage`.** The local-filesystem implementation has no equivalent and is what runs in *both* dev and prod (on a PVC); a Spaces/S3 adapter + signed URLs is a follow-up — it was tied to the now-retired DO Spaces ([ADR-0009](./adr/0009-hetzner-project-02-over-doks.md)).
- **No SignalR frontend client.** Server side is fully wired (hub, dispatcher, RabbitMQ consumers, Redis backplane); browser side is not. Honest about this in the L2 diagram.
- **No distributed tracing.** `CorrelationId` propagation is in place (Serilog + Hangfire), so traces are reconstructable from logs. A span-aware UI (Tempo/Jaeger) is a post-M5 layer — and the reason `prometheus-net` over OpenTelemetry is an acceptable call today.

## How to use this document

If you opened this thinking "what is MyProperty?" — read [`context.md`](./context.md) first, then come back. If you opened it thinking "what runs where?" — go to [`containers.md`](./containers.md), then [`deployment-prod.md`](./deployment-prod.md). If you opened it thinking "how does it behave at runtime?" — read [`process-flows.md`](./process-flows.md). If you opened it thinking "what's the data model?" — read [`../database/README.md`](../database/README.md). If you opened it thinking "I need to understand a specific decision in detail" — the relevant ADR is linked above and stands alone.
