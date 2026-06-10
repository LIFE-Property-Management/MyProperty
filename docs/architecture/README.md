# Architecture — MyProperty Platform

This is the **M5.1 deliverable**: a complete view of the system, every technology labelled, every load-bearing decision justified. Read it in the order below if you're new; jump to a leaf if you came here for a specific question.

> **Source of truth:** the diagrams here are produced from `.puml` sources in [`diagrams/`](./diagrams/). Re-render with `pwsh -File scripts/render-architecture-diagrams.ps1` from the repo root.

## Start here

| If you want to know… | Read |
|---|---|
| What is MyProperty and who uses it? | [**L1 — System Context**](./context.md) |
| What runs where, and using what tech? | [**L2 — Containers**](./containers.md) |
| What's inside the .NET API process? | [**L3 — Components (backend)**](./components.md) |
| How does data actually flow at runtime & build time? | [**Process flows (behavioural)**](./process-flows.md) — the canonical behavioural view, companion to [`data-flow.md`](./data-flow.md) |
| What's the data model / database schema? | [**Data model**](../database/) |
| The full story behind the major choices | [**Technology decisions (narrative)**](./technology-decisions.md) |
| The reasoning for a specific call | [ADRs](./adr/) (see below) |

## Diagrams

The C4 hierarchy + 6 supplemental diagrams. All sources live in [`diagrams/`](./diagrams/) as `.puml`; rendered SVGs are committed alongside so GitHub renders the docs inline.

### C4 hierarchy

| # | Diagram | View | Companion doc |
|---|---|---|---|
| 1 | [`context.svg`](./diagrams/context.svg) | C4 L1 — System Context (actors, system, external SaaS) | [`context.md`](./context.md) |
| 2 | [`containers.svg`](./diagrams/containers.svg) | C4 L2 — Containers (every runtime + datastore inside the system) | [`containers.md`](./containers.md) |
| 3 | [`components.svg`](./diagrams/components.svg) | C4 L3 — Components inside the API process (Clean Architecture, per project) | [`components.md`](./components.md) |

### Deployment

| # | Diagram | View | Companion doc |
|---|---|---|---|
| 4 | [`deployment-dev.svg`](./diagrams/deployment-dev.svg) | Dev deployment — 23 docker-compose services (21 default + 2 proxy) + 13 named volumes | [`deployment-dev.md`](./deployment-dev.md) |
| 5 | [`deployment-prod.svg`](./diagrams/deployment-prod.svg) | Prod deployment — shared Hetzner cluster (namespace `project-02`) + Helm + Longhorn + Calico + cert-manager | [`deployment-prod.md`](./deployment-prod.md) |

### Specialized supplements

| # | Diagram | View | Companion doc |
|---|---|---|---|
| 6 | [`data-flow-rest.svg`](./diagrams/data-flow-rest.svg) + [`data-flow-signalr.svg`](./diagrams/data-flow-signalr.svg) + [`data-flow-ocr.svg`](./diagrams/data-flow-ocr.svg) | Three runtime sequences — REST request, SignalR push, receipt OCR pipeline | [`data-flow.md`](./data-flow.md) |
| 7 | [`cicd.svg`](./diagrams/cicd.svg) | CI/CD pipeline — 8 GitHub Actions workflows → GHCR → Hetzner `project-02` | [`cicd.md`](./cicd.md) |
| 8 | [`observability.svg`](./diagrams/observability.svg) | Observability stack — metrics, logs, alerts, external probes | [`observability.md`](./observability.md) |
| 9 | [`events.svg`](./diagrams/events.svg) | RabbitMQ event topology — exchange + 5 queues + 5 consumers | [`events.md`](./events.md) |

### Domain state machines

The two server-enforced lifecycles at the heart of the domain. Both are described in prose in [`process-flows.md`](./process-flows.md) (Flows 5–7); these diagrams render the legal transitions, their guards, and who triggers each.

| # | Diagram | View | Companion |
|---|---|---|---|
| 10 | [`state-payment.svg`](./diagrams/state-payment.svg) | Payment lifecycle — Outstanding → Pending → Confirmed/Rejected (+ resubmit loop) | [`process-flows.md`](./process-flows.md) Flow 5 |
| 11 | [`state-invite.svg`](./diagrams/state-invite.svg) | Invite lifecycle — Pending → Accepted/Rejected/Expired (→ cleanup) | [`process-flows.md`](./process-flows.md) Flow 7 |

> **Behavioural companion:** [`process-flows.md`](./process-flows.md) enumerates *every* runtime & build-time flow end-to-end with code-level detail — the prose counterpart to the three rendered sequences in [`data-flow.md`](./data-flow.md).

## Architectural Decision Records (ADRs)

The ten load-bearing decisions, each with context, decision, consequences, and the alternatives we considered. Numbered roughly in the order they were made.

| ADR | Decision | Alternative rejected |
|---|---|---|
| [0001](./adr/0001-keycloak-over-custom-auth.md) | **Keycloak** (self-hosted) | Auth0 / custom JWT + ASP.NET Identity |
| [0002](./adr/0002-rabbitmq-over-kafka.md) | **RabbitMQ** (topic exchange) | Apache Kafka / MassTransit / in-process events |
| [0003](./adr/0003-hangfire-over-temporal.md) | **Hangfire** (Postgres-backed) | Temporal / Quartz / IHostedService-only |
| [0004](./adr/0004-doks-over-gke-eks.md) | ~~**DigitalOcean (DOKS)** + Terraform~~ — **superseded by [0009](./adr/0009-hetzner-project-02-over-doks.md)** | GKE / EKS / AKS / self-hosted K8s |
| [0005](./adr/0005-anthropic-over-openai.md) | **Anthropic Claude** (Sonnet + Haiku); **receipt OCR** instead of RAG | OpenAI / Vertex / pgvector RAG |
| [0006](./adr/0006-nextjs-app-router-over-remix.md) | **Next.js App Router** | Remix / SvelteKit / plain React+Vite |
| [0007](./adr/0007-loki-over-elk.md) | **Loki + Promtail** | ELK Stack / OpenSearch / FluentBit + ClickHouse |
| [0008](./adr/0008-tanstack-query-over-swr.md) | **TanStack Query v5** + **Zustand** | SWR / RTK Query / Apollo / plain fetch |
| [0009](./adr/0009-hetzner-project-02-over-doks.md) | **Shared Hetzner cluster** (namespace `project-02`); self-hosted data tier; push-based CD | DOKS (superseded) / GKE / EKS / self-managed cluster |
| [0010](./adr/0010-unleash-for-feature-flags.md) | **Self-hosted Unleash** feature flags (receipt-OCR kill-switch) | LaunchDarkly / Flagsmith / config-file flags |

## Conventions

### How to read these diagrams

- **C4 conventions** apply throughout. Persons are stick figures; software systems are rounded blue boxes; external systems are gray; containers (deployable runtimes) carry a `[Technology]` label; components are the layer below that. ADR-0004 covers the C4 model in more depth.
- **Edge labels carry the protocol** (HTTPS / OIDC / AMQP / SMTP / WSS / ACME) — the *direction* of the arrow is from caller to callee.
- **Dashed edges** are optional / conditional (e.g., cert renewal).
- The diagram source (`.puml`) is the truth; the `.svg` is regenerated from it. **Never edit the SVG by hand.**

### How to add a new technology to the diagrams

1. Add the new service / library to the relevant `.puml` source. Use the same C4 macro family (`Container`, `ContainerDb`, `Container_Ext`, etc.) as the surrounding context — see the existing files for examples.
2. Re-render with `pwsh -File scripts/render-architecture-diagrams.ps1` (downloads `plantuml.jar` on first run; gitignored).
3. Add the tech to the corresponding companion `.md`'s technology table.
4. If the choice is load-bearing (it replaces a peer, has trade-offs worth recording, or surprises someone reading the diagram), add an ADR under [`adr/`](./adr/) and link to it from the table.
5. Commit `.puml` + `.svg` + the updated `.md` together — keep the source and the rendered output in lockstep.

### When something in this folder is wrong

The code is the truth; the diagrams are a model of the code. When the model drifts (a service is renamed, an event is added, a new dependency lands), open a PR that updates the relevant `.puml` and `.md` in the same change. The CD workflow does not block on architecture-doc drift — that's a deliberate trade — so the responsibility for keeping it accurate sits with whoever changes the system.

## Re-rendering the diagrams locally

```powershell
# From the repo root:
pwsh -File scripts/render-architecture-diagrams.ps1
```

Requirements:
- Java ≥ 11 on PATH.
- The script downloads `tools/plantuml.jar` (~28 MB) on first run from the latest GitHub release; the jar is gitignored.

To render a single diagram:

```powershell
java -jar tools/plantuml.jar -tsvg docs/architecture/diagrams/<name>.puml
```

## Out of scope for this document

- **Tutorials** for how to use the system — see [`docs/portals.md`](../portals.md) for the domain features and lease/tenant flows.
- **Operations runbooks** — see [`docs/operations/`](../operations/) for migrations, CI/CD, auth flow, feature flags, Nginx SSL, security hardening.
- **Performance tuning** — see [`docs/performance/`](../performance/) for the M3 SQL optimization deliverables and Lighthouse reports.
- **Frontend-specific patterns** — see [`frontend/CLAUDE.md`](../../frontend/CLAUDE.md).
- **Backend-specific patterns** — see [`backend/CLAUDE.md`](../../backend/CLAUDE.md).
