# MyProperty

A property-management SaaS: landlords manage properties, leases, tenants, payments, and
receipts; tenants accept invites and view their lease. Built as a .NET 10 API + Next.js 16
frontend, with Keycloak for auth, deployed to a shared Hetzner Kubernetes cluster via Helm.

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

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript), Tailwind |
| Backend | .NET 10 Web API, Clean Architecture (Api / Application / Domain / Infrastructure), EF Core + Postgres |
| Auth | Keycloak (OIDC); per-portal realm roles (Landlord / Tenant) |
| Async / cache | RabbitMQ (background jobs, domain events), Redis |
| Storage | Local volume in dev; receipts/files keyed in Postgres |
| Observability | Prometheus + Alertmanager + Grafana, Loki + Promtail, Uptime-Kuma, AIOps webhook (Claude triage → Discord) |
| Automation | n8n — tenant-inquiry triage pipeline (webhook → Claude → Discord) |
| Packaging | Docker images on GHCR (`ghcr.io/life-property-management/*`), Helm chart `helm/myproperty` |

## Repository layout

```
backend/            .NET 10 solution (MyProperty.sln) — Api, Application, Domain, Infrastructure, Tests
frontend/           Next.js 16 app
helm/myproperty/    Helm chart (base values.yaml + values-gjirafa.yaml overlay for project-02)
infrastructure/
  aiops-webhook/    FastAPI service: Alertmanager → Claude triage → Discord
  n8n/              n8n automation: tenant inquiry → Claude triage → Discord (M5.8)
  uptime-kuma/      Uptime-Kuma seed sidecar (status page + monitors)
  gjirafa/          deploy.sh, secrets.sh — the project-02 deploy/secrets tooling
  keycloak/         realm export template + production notes (compose realm source)
  nginx/            docker-compose `proxy` profile (local HTTPS reverse proxy + certbot)
  prometheus/ grafana/ alertmanager/ promtail/ postgres/   local monitoring config
docs/               operations/, decisions/, milestones/, audits/, … (see Documentation below)
scripts/            reset-dev-stack.sh
docker-compose.yml  full local dev stack
```

## Local development

**Prerequisites:** Docker + Docker Compose, .NET 10 SDK, Node 20+ (for frontend work outside compose).

1. Copy the env templates and fill them in:
   ```bash
   cp .env.example .env
   cp frontend/.env.local.example frontend/.env.local
   # optional local-HTTPS reverse proxy: cp .env.proxy.example .env  (see docs/operations/nginx-ssl.md)
   ```
2. Bring up the full stack (Postgres, Keycloak + realm import, backend, frontend, Redis,
   RabbitMQ, mailhog, and the monitoring services):
   ```bash
   docker compose up -d
   ```
   App → http://localhost:3000 · API → http://localhost:5042 · Keycloak → http://localhost:8080
3. Optional local HTTPS + subdomain routing (`app.`/`api.`/`auth.myproperty.localhost`):
   ```bash
   ./infrastructure/nginx/init-selfsigned.sh
   docker compose --profile proxy up -d
   ```
4. Reset to a clean slate (wipes DB + file storage together, re-imports the realm):
   ```bash
   ./scripts/reset-dev-stack.sh
   ```

Once the stack is up, the services are reachable at:

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

Running the apps directly (outside compose) for a faster inner loop:
```bash
# Backend
dotnet run --project backend/MyProperty.Api
# Frontend (from frontend/)
npm install && npm run dev
```

## Testing

```bash
# Backend — unit + integration (integration uses Testcontainers: real Postgres + Keycloak)
dotnet test MyProperty.sln

# Frontend (from frontend/)
npm run lint && npm run typecheck && npm test
npm run test:e2e:install && npm run test:e2e   # Playwright (first run installs Chromium)
```

CI mirrors these per-service; see [docs/operations/ci-cd.md](docs/operations/ci-cd.md) for the
exact gates and the "run every CI step locally" cheat sheet.

## Deployment

MyProperty runs in namespace `project-02` on a shared Hetzner cluster (namespace-admin only),
deployed from the `helm/myproperty` chart with the `values-gjirafa.yaml` overlay.

- **Automated (CD):** push to `develop`/`main` → per-service CI builds + pushes images → the
  CD workflow resolves per-component image tags, bumps `values-gjirafa.yaml`, and runs
  `deploy.sh --atomic` behind a manual approval gate. See
  [docs/operations/ci-cd.md](docs/operations/ci-cd.md).
- **Manual / break-glass:** pin the image tag(s) in `helm/myproperty/values-gjirafa.yaml`,
  then `bash infrastructure/gjirafa/deploy.sh`. Secrets are managed with
  `infrastructure/gjirafa/secrets.sh`. Full runbook (incl. cluster prerequisites, the
  forward-only migration hook, and the two-phase store wipe) in
  [docs/operations/k8s-deployment.md](docs/operations/k8s-deployment.md).

> EF schema migrations run as a Helm **pre-upgrade hook** and are **forward-only** — a failed
> deploy rolls workloads back but does not un-apply schema. CD never wipes/auto-provisions
> data stores; fresh-store provisioning is a manual two-phase step.

## Documentation

| Doc | What |
|---|---|
| [docs/architecture/README.md](docs/architecture/README.md) | Architecture (C4 diagrams, ADRs, dev + prod deployment views) — the M5.1 deliverable |
| [docs/operations/k8s-deployment.md](docs/operations/k8s-deployment.md) | Cluster deploy runbook (the source of truth for live ops) |
| [docs/operations/ci-cd.md](docs/operations/ci-cd.md) | CI workflows + the CD pipeline |
| [docs/operations/auth-flow.md](docs/operations/auth-flow.md) | Keycloak / OIDC auth flow |
| [docs/operations/migrations.md](docs/operations/migrations.md) | EF Core migration strategy |
| [docs/operations/k8s-deployment.md](docs/operations/k8s-deployment.md) (§ monitoring) | Observability stack (Prometheus/Grafana/Loki/Uptime-Kuma/AIOps) |
| [docs/operations/deployment-roadmap.md](docs/operations/deployment-roadmap.md) | Deferred / planned infra work |
| [docs/operations/n8n-automation.md](docs/operations/n8n-automation.md) | n8n tenant-inquiry automation (M5.8) — design, degradation, verification |
| [docs/performance/](docs/performance/) | Performance work — SQL optimization, Redis caching benchmarks, Lighthouse reports |
| [docs/portals.md](docs/portals.md) | Landlord / Tenant portal scope |

Component-level guidance for contributors lives in `backend/CLAUDE.md` and `frontend/CLAUDE.md`.

## Re-rendering the architecture diagrams

The architecture docs embed SVGs that are rendered from PlantUML sources committed alongside them. To regenerate after editing a `.puml`:

```powershell
# From the repo root (Windows PowerShell):
pwsh -File scripts/render-architecture-diagrams.ps1
```

Requires Java ≥ 11 on PATH. The script downloads `tools/plantuml.jar` (~28 MB, gitignored) on first run.
