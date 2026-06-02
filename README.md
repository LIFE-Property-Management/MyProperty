# MyProperty

A property-management SaaS: landlords manage properties, leases, tenants, payments, and
receipts; tenants accept invites and view their lease. Built as a .NET 10 API + Next.js 16
frontend, with Keycloak for auth, deployed to a shared Hetzner Kubernetes cluster via Helm.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router, TypeScript), Tailwind |
| Backend | .NET 10 Web API, Clean Architecture (Api / Application / Domain / Infrastructure), EF Core + Postgres |
| Auth | Keycloak (OIDC); per-portal realm roles (Landlord / Tenant) |
| Async / cache | RabbitMQ (background jobs, domain events), Redis |
| Storage | Local volume in dev; receipts/files keyed in Postgres |
| Observability | Prometheus + Alertmanager + Grafana, Loki + Promtail, Uptime-Kuma, AIOps webhook (Claude triage → Discord) |
| Packaging | Docker images on GHCR (`ghcr.io/life-property-management/*`), Helm chart `helm/myproperty` |

## Repository layout

```
backend/            .NET 10 solution (MyProperty.sln) — Api, Application, Domain, Infrastructure, Tests
frontend/           Next.js 16 app
helm/myproperty/    Helm chart (base values.yaml + values-gjirafa.yaml overlay for project-02)
infrastructure/
  aiops-webhook/    FastAPI service: Alertmanager → Claude triage → Discord
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
| [docs/operations/k8s-deployment.md](docs/operations/k8s-deployment.md) | Cluster deploy runbook (the source of truth for live ops) |
| [docs/operations/ci-cd.md](docs/operations/ci-cd.md) | CI workflows + the CD pipeline |
| [docs/operations/auth-flow.md](docs/operations/auth-flow.md) | Keycloak / OIDC auth flow |
| [docs/operations/migrations.md](docs/operations/migrations.md) | EF Core migration strategy |
| [docs/operations/k8s-deployment.md](docs/operations/k8s-deployment.md) (§ monitoring) | Observability stack (Prometheus/Grafana/Loki/Uptime-Kuma/AIOps) |
| [docs/operations/deployment-roadmap.md](docs/operations/deployment-roadmap.md) | Deferred / planned infra work |
| [docs/portals.md](docs/portals.md) | Landlord / Tenant portal scope |

Component-level guidance for contributors lives in `backend/CLAUDE.md` and `frontend/CLAUDE.md`.
