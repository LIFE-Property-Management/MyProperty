# Technology decisions — the story

This document walks through *why* the platform looks the way it does, in roughly the order the decisions were made. It is the connective tissue between the C4 diagrams (what runs) and the ADRs (the formal record of each load-bearing call). Read this first if you want the high-level story; read the ADRs next if you want the trade-offs in detail.

## The problem

MyProperty is a **multi-tenant property-management SaaS**. Two end-user roles — *Tenant* and *Landlord* — share most of the surface and diverge in two portals (`/tenant/dashboard` for tenants; `/dashboard` for landlords). A third role, *Admin*, operates the Hangfire dashboard and the Keycloak realm. Tenants pay rent and upload receipts; landlords manage properties, leases, payments, and approve or reject submitted payments. The end-to-end flow that exercises the most moving parts is *landlord confirms a payment* — a synchronous REST call that triggers an asynchronous email + real-time push to the tenant. That flow is the spine of the system; most architectural choices serve it.

The non-negotiable constraints, from the milestones doc, were: production-shaped K8s deployment with monitoring, real-time UI updates, OIDC SSO with RBAC, an AI-powered feature, structured logging, file uploads, and a CI/CD pipeline that scans images for CVEs. The deliberate non-goals were RAG/pgvector (no domain use case for vector search), MediatR (paid license + indirection), and AutoMapper (DTO mapping is hand-rolled today; Mapperly source-gen is the planned retrofit). Each of those omissions is justified inline at the point it would otherwise appear.

## Why Clean Architecture, and why one .NET process

The backend ships as four .NET 10 projects in strict layering — `Api → Application → Domain` plus `Infrastructure → Application` — enforced by project references. *No* EF Core or ASP.NET types are allowed in `Application` or `Domain`. Interfaces in `Application` (e.g., `IPaymentRepository`, `INotificationDispatcher`, `IEmailSender`, `IReceiptOcrService`, `IFileStorage`) are the ports; implementations in `Infrastructure` are the adapters. The handlers in `Application` never know which adapter is wired in, which is what makes the test fixture able to swap `IDistributedCache` for `MemoryDistributedCache` and `IBackgroundJobQueue` for a recording fake without touching production code.

The three roles inside the .NET process — REST API, SignalR `NotificationsHub`, Hangfire job server — all run in the same OS process. C4 calls this *one container*; the only reason to split it would be to scale the OCR worker independently of the request-serving pods, and at MVP scale that's not warranted. When it is, the split is a deployment change, not a code change.

## Why Keycloak, and the cost of self-hosting an IdP

[ADR-0001](./adr/0001-keycloak-over-custom-auth.md) records the choice. The short version: M3.2 mandates OIDC + OAuth2 SSO + RBAC, and we have no per-MAU budget. Custom JWT + ASP.NET Identity would re-implement Google IdP federation, password-reset email flows, refresh-token rotation, the admin console, and JWKS rotation — that work doesn't fit the M3 budget and the result is strictly worse than Keycloak. Auth0 / Okta are excluded by cost.

The price is one more stateful service to operate. Keycloak's Quarkus distribution boots in ~10 s, its realm config is version-controlled in `realm-export.template.json`, and the integration test fixture spins up a real Keycloak Testcontainer per run — so we test what we deploy. The 5-minute setup cost of inline-Java healthchecks (Keycloak 26's UBI Micro base ships no curl) is paid back the first time a deploy needs to reproduce.

## Why RabbitMQ, and why direct `RabbitMQ.Client`

Event volume is tens per minute, not millions per second. AMQP topic routing (`{aggregate}.{verb}`, derived automatically from event type names) maps cleanly to domain semantics; fan-out — already used for `payment.submitted` → both SignalR push and Hangfire OCR enqueue — is one extra binding, not a code change. Kafka would be designed-for-replay infrastructure for a workload that doesn't need replay. [ADR-0002](./adr/0002-rabbitmq-over-kafka.md) records the call.

MassTransit is the obvious "abstract over RabbitMQ" library; we declined it. With five consumers that all subclass a single `IntegrationEventConsumerBase`, the abstraction would be larger than the thing it abstracts.

## Why Hangfire, and why in-process

The two ad-hoc jobs in production today (`SendEmailJob` with retry-and-DLQ, `ReceiptOcrJob`) plus recurring scans — **two now scheduled** via `RecurringJob.AddOrUpdate` (`MarkExpiredInvitesJob` hourly, `OrphanCleanupJob` daily 03:00 UTC), with mark-overdue-payments and lease-expiring still to come — fit Hangfire's surface exactly. It uses the Postgres we already have — no new infrastructure — gives us a web dashboard for free, and runs in-process so jobs share the same `IServiceScope` as the request handlers. [ADR-0003](./adr/0003-hangfire-over-temporal.md) records the call. Temporal would buy us workflow orchestration we don't need; Quartz lacks a dashboard.

## Why the events + signals pattern

Every business action that has user-visible side effects follows the same shape:

1. The HTTP handler mutates state synchronously inside one unit of work and commits.
2. The handler publishes an integration event **after** the DB commit.
3. RabbitMQ consumers translate the event into side effects: durable retryable work goes to Hangfire (email, OCR); instant UX feedback goes to SignalR.

This means the request response returns fast (no waiting on Anthropic or SMTP), email delivery is durable (Hangfire retries + DLQ), and the UI feels live (SignalR push invalidates a TanStack query → refetch). The handler's commit-then-publish ordering leaves a small race window where the commit succeeds and the publish fails — acceptable here because consumers are idempotent, and the outbox pattern is a clean follow-up if exactly-once semantics ever become a requirement.

## Why SignalR delivers signals, not state

The frontend treats TanStack Query as the source of truth for data. SignalR delivers **signals** — `{ paymentId, confirmedAt }` payloads that cause `queryClient.invalidateQueries(...)` to refetch authoritative state from the API. The hub is server-push only; clients have no callable methods. The Redis backplane fans out across backend replicas (configured but unused today, since `replicas: 1` in prod for unrelated PVC reasons). If a push is dropped, the next page navigation fetches authoritative data — no UX correctness depends on push reliability.

The frontend `@microsoft/signalr` client is **not yet wired**. The server-side hub, the backplane, the dispatcher abstraction, and the RabbitMQ consumer that triggers pushes all exist; what's missing is the browser-side connection. This is called out honestly in [`containers.md`](./containers.md) and [`data-flow.md`](./data-flow.md) — the diagrams should not lie about the system's state.

## Why Anthropic — and why receipt OCR instead of RAG

[ADR-0005](./adr/0005-anthropic-over-openai.md) records two related decisions. First, we substituted *receipt OCR* for the original *RAG + pgvector* deliverable: the domain has no genuine semantic-search use case (entities are relational and well-served by SQL), while receipt OCR is a real UX improvement that pre-fills the payment-submission form. The milestones doc allows substitutions; this is one.

Second, Anthropic Claude over OpenAI / Vertex. Sonnet for receipt OCR (vision quality on structured documents, parseable JSON output, ~30 s budget); Haiku for AIOps alert triage (cheap enough that chatty alerts don't burn budget, fast enough that triage feels responsive). One vendor, one API key per environment, one billing dashboard. The vendor-concentration risk is real and accepted — both surfaces have graceful degradation paths (the AIOps webhook posts raw labels to Discord if `ANTHROPIC_API_KEY` is empty; receipt OCR shows an empty result and the user fills the form by hand).

## Why a feature flag guards the receipt OCR

The OCR path is the one place the system spends money per request on a third-party vendor. M5.6 added a runtime **kill-switch** so that path can be turned off without a redeploy — if the key is rotated, costs spike, or extraction misbehaves. That is a feature-flag requirement, and we self-host **Unleash** for it rather than pay a SaaS per-seat: it reuses the Postgres we already run (a dedicated `unleash` database), and the backend depends on an Application-layer `IFeatureFlags` port (not the SDK) so the abstraction stays where the other ports live. `payments.ocr-autoextract` is checked in `PaymentSubmittedOcrConsumer` with a **fail-open** default — if Unleash is unreachable, OCR still runs; if the flag is deliberately off, submitted receipts stay manual-entry and no Anthropic call is made. [ADR-0010](./adr/0010-unleash-for-feature-flags.md) records the call.

## Why a shared Hetzner cluster (project-02) for prod

Production *originally* ran on DigitalOcean DOKS ([ADR-0004](./adr/0004-doks-over-gke-eks.md), now superseded). In the M5 de-DOKS pass we moved onto a **namespace (`project-02`) on a shared Hetzner cluster** that Gjirafa operates — free to us, where DOKS still billed for nodes + managed Postgres + Spaces for a continuously-running demo. [ADR-0009](./adr/0009-hetzner-project-02-over-doks.md) records the move.

The one constraint that shapes everything is **namespace-admin only** — no cluster-scoped permissions. That single fact is why prod has *no* Terraform (nothing to provision for a borrowed namespace), *no* Prometheus Operator (the `kube-prometheus-stack` dependency was replaced with self-contained Prometheus/Alertmanager/Grafana manifests, since CRDs are cluster-scoped), a namespaced cert-manager `Issuer` instead of a `ClusterIssuer`, manual K8s Secrets instead of an External Secrets Operator, a namespaced-`Role` Promtail instead of a cluster-wide DaemonSet, and push-based CD instead of GitOps. Every stateful service — Postgres, Redis, RabbitMQ, Keycloak, Unleash — is self-hosted in the namespace on Longhorn PVCs; the CNI is Calico, so `NetworkPolicy` enforcement (on in prod) works without extra wiring. The DO Managed Postgres + S3 Spaces conveniences went away with DOKS — receipts now live on a PVC via `LocalFileStorage`, and a Spaces/S3 adapter is a follow-up. For the demo budget, a free namespace beats a cheap-but-paid cluster.

## Why Loki, and one Grafana for everything

[ADR-0007](./adr/0007-loki-over-elk.md) records the choice. Loki's label-based indexing keeps its memory floor at ~256 MiB request, vs Elasticsearch's ~1–2 GiB JVM heap floor. On a cost-bounded node pool, that matters. Sacrifice: full-text search across all containers is slower than Elastic; labelled queries (`{container="myproperty-api"} | json | level="Error"`) are comparable. The .NET backend ships structured JSON to Loki directly via `Serilog.Sinks.Grafana.Loki` (preserving scopes + `CorrelationId`); every other container's stdout is tailed by Promtail — Docker socket SD in dev, DaemonSet + RBAC in prod.

The bigger win is one UI. We already need Grafana for metrics dashboards (M4.5), and Grafana's Loki datasource gives us logs in the same Explore view, with Alertmanager state alongside. Adding Kibana would be a second UI for one operator to mentally context-switch into.

## Why Next.js App Router for the frontend

[ADR-0006](./adr/0006-nextjs-app-router-over-remix.md) records the choice — partly mandated by M2.5, partly justified against Remix and SvelteKit on ecosystem maturity grounds. Every supporting library we needed (TanStack Query, React Hook Form, Zod, keycloak-js, Framer Motion, MSW, Playwright) integrates with Next.js out of the box. The standalone production bundle (`output: 'standalone'`) compresses well into a distroless Node 20 image (UID 65532, ~90% smaller than the default node base).

[ADR-0008](./adr/0008-tanstack-query-over-swr.md) records the TanStack Query choice. The query-key hierarchy in `lib/hooks/queryKeys.ts` plus ~20 typed hooks makes SignalR integration mechanical: a future hub handler will be one `queryClient.invalidateQueries(queryKeys.tenant.payment.current)` away.

## Why CI/CD looks the way it does

**Six** GitHub Actions workflows — five CI (`backend-ci.yml`, `frontend-ci.yml`, `aiops-webhook-ci.yml`, `uptime-kuma-init-ci.yml`, plus `realm-import-ci.yml`, which only smoke-tests the Keycloak realm and builds no image) and one CD (`cd.yml`). Each image-building CI workflow lints, tests, builds a Docker image, scans it twice with Trivy (SARIF non-blocking for HIGH+CRITICAL, gate blocking for CRITICAL only), generates a CycloneDX SBOM, and pushes to GHCR.

CD is **push-based** and namespace-scoped — GitOps (ArgoCD/Flux) is impossible because the service account is namespace-admin only. `cd.yml` fires on `workflow_run` after the image-CI workflows finish on `develop`/`main`, behind the protected `project-02` Environment (manual approval). It resolves which component images exist at the triggering SHA, bumps the matching tags in `values-gjirafa.yaml` (a byte-perfect `ruamel` edit, pushed by a GitHub App that's on the branch-ruleset bypass list), then runs `infrastructure/gjirafa/deploy.sh --atomic` — the same script as a manual deploy. The `--atomic` flag does more than it looks: it rolls a failed deploy's *workloads* back to the previous release. EF Core migrations run as a pre-upgrade Helm Hook but are **forward-only**, so a failed deploy can leave the DB partly migrated — verified manually, not auto-rolled-back. [`cicd.md`](./cicd.md) has the full pipeline; [ADR-0009](./adr/0009-hetzner-project-02-over-doks.md) the platform move.

Postgres is **self-hosted in both dev and prod** now (`postgres.enabled: true` in `values-gjirafa.yaml`) — the old `--set postgres.enabled=false` swap to DO Managed PostgreSQL went away with DOKS.

## What we deliberately did not do

A faithful architecture document names its omissions. The list:

- **No RAG / pgvector.** Substituted with receipt OCR (M3.10). Reason: no semantic-search use case in the domain.
- **No MediatR.** CQRS folder structure used directly; controllers inject handlers and call `Handle(...)`. Reason: MediatR moved to a paid license in 2024 and we don't need pipeline behaviours.
- **No AutoMapper.** Entity ↔ DTO mapping is hand-rolled in each handler today; a Mapperly source-generator retrofit is a documented post-M3 follow-up. Reason: reflection-free, build-time errors, faster — and AutoMapper's runtime cost + reflection model is exactly what we want to avoid.
- **No MassTransit.** Direct `RabbitMQ.Client` for five consumers. Reason: abstraction overhead exceeds the thing it abstracts.
- **No generic `IRepository<T>`.** One repository per aggregate, methods named for use cases. Reason: generic repositories leak `IQueryable` and defeat the purpose.
- **No `GetSignedUrlAsync` on `IFileStorage`.** The local-filesystem implementation has no equivalent and is what runs in *both* dev and prod (on a PVC); a Spaces/S3 adapter + signed URLs is a follow-up — it was tied to the now-retired DO Spaces ([ADR-0009](./adr/0009-hetzner-project-02-over-doks.md)).
- **No SignalR frontend client.** Server side is fully wired (hub, dispatcher, RabbitMQ consumers, Redis backplane); browser side is not. Honest about this in the L2 diagram.
- **No distributed tracing.** `CorrelationId` propagation is in place (Serilog + Hangfire), so traces are reconstructable from logs. Span-aware UI is a post-M5 layer.

## How to use this document

If you opened this thinking "what is MyProperty?" — read [`context.md`](./context.md) first, then come back. If you opened it thinking "what runs where?" — go to [`containers.md`](./containers.md), then [`deployment-prod.md`](./deployment-prod.md). If you opened it thinking "I need to understand a specific decision in detail" — the relevant ADR is linked above and stands alone.
