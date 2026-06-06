# MyProperty

A multi-tenant property-management SaaS — Next.js frontend, .NET 10 API, PostgreSQL + Keycloak + RabbitMQ + Redis + Unleash, deployed to a shared Hetzner Kubernetes cluster (namespace `project-02`) via Helm with full observability and CI/CD.

This is a school project (LIFE Fellows AI Engineering — Group Project). Milestones, deliverables, and a technical requirements checklist live in the project brief.

## Architecture

Start at [`docs/architecture/README.md`](./docs/architecture/README.md) — the **M5.1 deliverable**. It is the single source of truth for what runs, where, and why.

| If you want… | Read |
|---|---|
| The whole story in prose | [`docs/architecture/technology-decisions.md`](./docs/architecture/technology-decisions.md) |
| A high-level system picture | [`docs/architecture/context.md`](./docs/architecture/context.md) (C4 L1) |
| Every runtime + datastore + tech label | [`docs/architecture/containers.md`](./docs/architecture/containers.md) (C4 L2) |
| The backend's Clean Architecture layout | [`docs/architecture/components.md`](./docs/architecture/components.md) (C4 L3) |
| The dev (Docker Compose) deployment | [`docs/architecture/deployment-dev.md`](./docs/architecture/deployment-dev.md) |
| The prod (Hetzner `project-02` + Helm) deployment | [`docs/architecture/deployment-prod.md`](./docs/architecture/deployment-prod.md) |
| Runtime data flows (REST, SignalR, OCR) | [`docs/architecture/data-flow.md`](./docs/architecture/data-flow.md) |
| The CI/CD pipeline | [`docs/architecture/cicd.md`](./docs/architecture/cicd.md) |
| The observability stack | [`docs/architecture/observability.md`](./docs/architecture/observability.md) |
| The RabbitMQ event topology | [`docs/architecture/events.md`](./docs/architecture/events.md) |
| The reasoning behind a specific call | [`docs/architecture/adr/`](./docs/architecture/adr/) (10 ADRs) |

## Quick start (local dev)

```bash
# 19 services on a single bridge network:
docker compose up -d

# Add the Nginx + Certbot edge (2 extra services on profile 'proxy'):
docker compose --profile proxy up -d
```

| Surface | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API + Hangfire dashboard | http://localhost:5042/swagger · http://localhost:5042/hangfire |
| Keycloak admin console | http://localhost:8080 |
| RabbitMQ management UI | http://localhost:15672 (guest / guest) |
| MailHog (dev SMTP catcher) | http://localhost:8025 |
| Prometheus | http://localhost:9090 |
| Alertmanager | http://localhost:9093 |
| Grafana | http://localhost:3001 |
| Uptime Kuma + status page | http://localhost:3002 |
| Unleash (feature flags) | http://localhost:4242 |

Full inventory of services + volumes + init containers in [`docs/architecture/deployment-dev.md`](./docs/architecture/deployment-dev.md).

## Per-component documentation

- Backend conventions, CQRS, repositories, events, jobs, auth — see [`backend/CLAUDE.md`](./backend/CLAUDE.md).
- Frontend conventions, App Router patterns, TanStack Query keys, Keycloak wiring — see [`frontend/CLAUDE.md`](./frontend/CLAUDE.md).
- Operations runbooks (migrations, CI/CD, auth flow, feature flags, Nginx SSL, security hardening) — see [`docs/operations/`](./docs/operations/).
- Performance work (SQL optimization, Redis caching benchmarks, Lighthouse reports) — see [`docs/performance/`](./docs/performance/).

## Re-rendering the architecture diagrams

The architecture docs embed SVGs that are rendered from PlantUML sources committed alongside them. To regenerate after editing a `.puml`:

```powershell
# From the repo root (Windows PowerShell):
pwsh -File scripts/render-architecture-diagrams.ps1
```

Requires Java ≥ 11 on PATH. The script downloads `tools/plantuml.jar` (~28 MB, gitignored) on first run.
