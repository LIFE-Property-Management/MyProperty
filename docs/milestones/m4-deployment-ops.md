# Milestone 4 — Deployment & Operations

> **Note (post-M5):** M4 targeted DigitalOcean DOKS. The project later pivoted to a shared
> **Hetzner** cluster (namespace `project-02`); the deliverables below are historical.
> Current deployment: [../operations/k8s-deployment.md](../operations/k8s-deployment.md).

**Status:** ✅ Complete
**Window:** May 13 – May 25, 2026
**Aligns with:** Section 3 — Deployment & DevOps

## Inherited debt to resolve

Carried over from [M3](./m3-backend-mvp.md). The M4 unblock sprint (May 13–17) was scoped specifically to clear these before main M4 deliverables began, because building Docker / Helm / CI-CD on top of an app that produces CORS errors, redirect loops, missing env vars, and Keycloak auth failures the moment containers come up on separate origins is a guaranteed stall.

Nine items from `docs/audits/m3-m4-audit/dev-prod-gaps.md`:

| Group | Items | Status at M4 close |
|---|---|---|
| Origin & routing (backend) | C1, H7, A1 backend | ✅ Plan 1, 2026-05-13 |
| Frontend build-time config | F1, F2, A2 (`.dockerignore`) | ✅ Plan 2, 2026-05-13 |
| Realm config | A6 verification + E5 production-mode spec | ✅ Plan 3, 2026-05-16 |
| K8s readiness | H1 (liveness/readiness/diagnostics split) | ✅ Plan 4, 2026-05-16 |
| Migration bundle | D2 (EF bundle artifact + CI publication) | ✅ Plan 5, 2026-05-17 |

Exit gate: a multi-container `docker compose up` succeeded and the browser at `http://localhost:3000` could (1) reach `/api/v1/health/live` without CORS errors, (2) initiate Keycloak login without redirect URI rejection, (3) complete a JWT-authenticated API call end-to-end, and (4) have no `.env.local` content baked into the frontend production image. Gate passed by 2026-05-17, unblocking M4.1.

## Deliverables

| ID | Deliverable | Description |
|---|---|---|
| M4.1 | Docker Compose full stack | All 11 services (frontend, backend, postgres, keycloak, rabbitmq, redis, prometheus, grafana, alertmanager, loki, promtail) orchestrated with healthchecks and dependency ordering |
| M4.2 | Production Dockerfiles | Multi-stage builds: chiseled .NET runtime backend (UID 1654, no shell), distroless Node runtime frontend (UID 65532), init container for storage `chown` |
| M4.3 | CI/CD pipeline | GitHub Actions per service: `dotnet format` gate, unit + integration tests against Testcontainers, Dependabot for .NET / npm / Docker / GHA, Trivy CRITICAL gate, GHCR image push tagged with short SHA |
| M4.4 | Kubernetes deployment via Helm | Chart `helm/myproperty/` with StatefulSets, Services, Ingress (ingress-nginx + cert-manager), ConfigMaps + Secrets, kube-prometheus-stack integration, single-knob image-tag overrides for CD |
| M4.5 | Monitoring stack | Prometheus `/metrics` exposed from backend (correlation IDs + RED metrics), Grafana RED dashboard provisioned-as-code, Alertmanager → Discord with grouping rules |
| M4.6 | Uptime monitoring | Uptime Kuma with seeded multi-monitor config (HTTP/HTTPS/cert expiry), status page, multi-channel notifications (Discord + email), Docker-image-baked seed |
| M4.7 | Cloud infrastructure (Terraform) | DOKS cluster + managed Postgres 16 + Spaces buckets (state + receipts) provisioned via two-stage Terraform; chart wired for managed-PG mode via `postgres.enabled` toggle |
| M4.8 | Security hardening | Trivy CRITICAL-blocking + SBOM (CycloneDX), distroless migration image (chiseled, UID 1654), External Secrets Operator templates (GCP + Azure), 13 NetworkPolicies with default-deny |
| M4.9 | Reverse proxy + SSL | Nginx + Let's Encrypt opt-in compose profile (`--profile ssl`) with cert auto-renewal sidecar; optional, since K8s deployment uses ingress-nginx + cert-manager instead |
| M4.10 | (Not pursued) Linux server | Superseded — see [M4.10 — Not pursued](#m410--not-pursued) below |
| M4.11 | AIOps alert pipeline | FastAPI webhook receiving Alertmanager firing events → Claude Haiku triage with structured prompt → enriched Slack/Discord notification; deployed as a chart workload |
| M4.12 | AI Log Entry #4 | Document AI usage across infra work — see [`../logs/m4-ai-logs.md`](../logs/m4-ai-logs.md) |

## Technical Requirements

| ID | Requirement | Details |
|---|---|---|
| OPS-1 | Containerization | All runtime workloads have Dockerfiles; production images use chiseled .NET / distroless Node bases; non-root users; readonly root filesystem where workload-compatible |
| OPS-2 | Local orchestration | `docker compose up` brings up the full stack end-to-end with realm import, healthchecks, and ordered startup |
| OPS-3 | Kubernetes manifests | Helm chart renders cleanly via `helm template`; in-cluster and managed-Postgres topologies via one value flag |
| OPS-4 | Observability | `/metrics` endpoints on backend; Prometheus scrape config; provisioned Grafana dashboards; Loki + Promtail log pipeline; Alertmanager routing |
| OPS-5 | CI gates | `dotnet format`, unit + integration tests, Trivy CRITICAL gate, image push to GHCR on `develop` / `main` |
| OPS-6 | Secret management | Pluggable: manual `kubectl create secret` (default), External Secrets Operator (GCP + Azure switchable), SealedSecrets documented as fallback |
| OPS-7 | Supply-chain | Dependabot across .NET / npm / Docker / GHA; CycloneDX SBOM artifacts; `.terraform.lock.hcl` committed; digest-pinning convention documented |
| OPS-8 | TLS termination | Compose: Nginx + Let's Encrypt opt-in profile. K8s: ingress-nginx + cert-manager ClusterIssuer |
| OPS-9 | Alerting | Prometheus → Alertmanager → AIOps webhook → Claude triage → Slack/Discord with grouped notifications |
| OPS-10 | Infrastructure-as-Code | Two-stage Terraform (bootstrap → main) for DOKS + managed PG 16 + Spaces buckets; remote state in Spaces; tear-down recipe documented |
| OPS-11 | Network segmentation | 13 NetworkPolicies opt-in (`networkPolicies.enabled=true`), default-deny + targeted allows per workload |
| OPS-12 | Status page | Public-facing Uptime Kuma instance with seeded multi-monitor config and multi-channel notification |

## Decisions

Cross-cutting decisions made during M4. Per-milestone decisions live in [Detailed entries](#detailed-entries).

- **DOKS as the managed-cluster target, not the Gjirafa cluster.** Gjirafa provides the production cluster but has not granted kubectl access during the M4 window. DOKS gives the same managed-K8s deployment practice with an independently-controllable target. This also supersedes M4.10 entirely.
- **Loki + Grafana retained.** No migration to ELK — the local Loki pipeline from M3.13 carries forward to compose + K8s. Deviation from the audit-suggested ELK stack documented for the M5 architecture doc.
- **Multi-tenancy deferred to M5.** A global-query-filter retrofit during M4 would have churned the chart and CI work mid-flight. The M5 architecture doc will pick this up alongside the OCR-table extraction and IDOR fix.
- **CI/CD scope is lint → test → build → push.** "Deploy via pipeline" is intentionally out of scope; CD performs `helm upgrade --install` against the cluster but provisioning (`terraform apply`) stays manual. Promoting Terraform into CI is a known follow-up.
- **Trivy CRITICAL-only blocking, HIGH visible but non-blocking.** Transitive .NET + Next.js HIGH advisories generate routine false positives; CRITICAL catches the genuinely urgent findings while HIGH stays visible in the SARIF report for scheduled triage. `.trivyignore` covers both severity tiers.
- **External Secrets Operator + NetworkPolicies opt-in (`enabled: false` default).** The chart must deploy on clusters without ESO or NetworkPolicy enforcement (graders, fresh kind/k3d clones). Default-off forces a deliberate per-cluster enablement decision.
- **Managed Postgres 16 over in-cluster on the production deploy.** `postgres.enabled=false` on the CD path. Stateful workloads on a 2-node demo cluster are operationally fragile; managed PG removes the backup/upgrade/HA burden. In-cluster path remains default for local compose and graders.
- **AIOps over status-quo paging.** Rather than dumping raw Alertmanager payloads into Slack, the webhook runs Claude Haiku over the firing event to produce a one-paragraph triage summary with likely-cause + suggested action. Cheaper than a paging tool and matches the AI-feature-required brief.
- **Linear stays as the project board.** No migration to a different tracker during M4.

## M4.10 — Not pursued

Originally scoped as "deploy on a managed Linux VM" as a backup deployment target distinct from the Kubernetes path. **Dropped:** Gjirafa is providing the production cluster, and M4.7's DOKS provisioning gives independent practice with a managed Kubernetes deployment — the deliverable's learning objective. Operating a separate single-host Linux deployment would duplicate the work without adding learning value or production utility for a project whose runtime topology is K8s end-to-end. Surface kept in the deliverables table for completeness; no work done, no follow-ups owed.

## Progress Log

Weekly summary of dated entries below. Each checkpoint references the dated entries in [Detailed entries](#detailed-entries) for full context.

### Week of May 13–17 — Unblock sprint + M4.1

#### Completed
- Plan 1 (backend origin & routing): C1, H7, A1 backend fixes. CORS + audience-mapper + per-origin routing.
- Plan 2 (frontend build-time config): F1, F2, A2 closed. `requirePublicEnv` helper with literal-property-access lookup table to survive turbopack/webpack static replacement. `.dockerignore` files for backend + frontend. Verification-grade `frontend/Dockerfile`. Side: bumped axios + next.js + postcss to close 28 audit findings (`npm audit`: 0 vulnerabilities).
- Plan 3 (realm + production-mode spec): A6, E5 closed. `realm-export.template.json` with envsubst init container, Java-based healthcheck replacing curl (curl-stripped from Keycloak 26 UBI Micro base — silent failure since image bump), `infrastructure/keycloak/PRODUCTION.md` runbook for the DevOps teammate.
- Plan 4 (K8s readiness): H1 closed. Health endpoint split into `/health/live`, `/health/ready`, `/health/diagnostics` with the right semantics per K8s probe contract.
- Plan 5 (migration bundle): D2 closed. EF bundle artifact published by CI, ready for chart consumption.
- M4.1 (Docker Compose full stack): all 11 services orchestrated, realm import wired through `keycloak-realm-init`, healthchecks landed on every service.

### Week of May 18–19 — Observability + production Dockerfiles + AIOps

#### Completed
- M4.5 (Monitoring stack): backend `/metrics` (RED + correlation IDs), provisioned Grafana RED dashboard, Alertmanager → Discord with grouping rules.
- M4.2 (Production Dockerfiles): chiseled .NET backend (UID 1654, no shell), multi-stage frontend (init-container for storage `chown`), readonly root filesystem where workload-compatible.
- M4.11 (AIOps webhook): FastAPI receiving Alertmanager firing events → Claude Haiku triage prompt → Slack-formatted enriched notification. Deployed as a chart workload.

### Week of May 20–21 — CI/CD pipeline + Nginx SSL

#### Completed
- M4.3 (CI/CD): per-service pipelines (backend / frontend / aiops-webhook); `dotnet format` gate, Dependabot across .NET + npm + Docker + GHA, baseline Trivy scan (non-blocking at this stage; CRITICAL-blocking lands in M4.8), GHCR image push tagged with short SHA.
- M4.9 (Nginx + SSL): opt-in compose profile (`docker compose --profile ssl up`) with Let's Encrypt cert auto-renewal sidecar. K8s deployment uses ingress-nginx + cert-manager, so this profile is for compose-based demos / local TLS testing.

### Week of May 22–23 — Helm chart + Uptime Kuma

#### Completed
- M4.4 (Kubernetes via Helm): full chart with StatefulSets (postgres, rabbitmq), Services, Ingress, ConfigMaps, Secrets, kube-prometheus-stack integration, namespace template (later removed in M4.7 — Helm hook delete-policy bug). CD `helm upgrade --install` step with `--set <component>.image.tag` overrides.
- M4.6 (Uptime Kuma): seeded multi-monitor config (HTTP, HTTPS, cert expiry per public hostname), status page, multi-channel notifications (Discord + email). Docker image baked from the seed so a fresh container starts pre-configured.

### Week of May 24–25 — Security hardening + cloud infrastructure

#### Completed
- M4.8 (Security hardening): Trivy two-pass (SARIF report + CRITICAL gate), CycloneDX SBOM artifacts, distroless migration image (chiseled), External Secrets Operator templates (GCP + Azure provider switch), 13 NetworkPolicies (opt-in, default-deny + targeted allows). Closes the M4.3 Trivy follow-up + four M4.4 carry-overs in one milestone.
- M4.7 (Terraform): two-stage Terraform (bootstrap for state bucket, main for cluster + DB + Spaces). DOKS fra1 1.34.8, managed PG 16, receipts Spaces bucket pre-provisioned for M5. Chart `postgres.enabled` toggle so the in-cluster and managed-PG topologies render from one source of truth. Full ops runbook in `docs/operations/terraform.md`.

## Detailed entries

Per-milestone deep-dives — scope, decisions, verification gates (G1..Gn), side notes, and known follow-ups — live in a companion file so this doc stays scannable:

→ **[`m4-deployment-ops-entries.md`](./m4-deployment-ops-entries.md)** (12 dated entries, ~1100 lines, primary execution record)

---

## Deliverable Status

| ID | Status | Notes |
|---|---|---|
| M4.1 | ✅ done | Full 11-service compose stack with realm import, healthchecks, dependency ordering. |
| M4.2 | ✅ done | Chiseled .NET backend (UID 1654), multi-stage frontend, init container for storage `chown`. |
| M4.3 | ✅ done | Per-service GHA pipelines; `dotnet format` gate, Dependabot, baseline Trivy, GHCR push. CRITICAL-blocking flip landed in M4.8. |
| M4.4 | ✅ done | Helm chart with StatefulSets/Services/Ingress/ConfigMaps/Secrets + kube-prometheus-stack; CD `helm upgrade --install` with per-component image tag overrides. |
| M4.5 | ✅ done | Backend `/metrics` (RED + correlation IDs), provisioned Grafana RED dashboard, Alertmanager → Discord with grouping rules. |
| M4.6 | ✅ done | Uptime Kuma seeded image with HTTP/HTTPS/cert-expiry monitors, status page, Discord + email notifications. |
| M4.7 | ✅ done | Two-stage Terraform (bootstrap + main) provisioning DOKS, managed PG 16, receipts Spaces bucket. Helm `postgres.enabled` toggle for in-cluster vs managed-PG topologies. Full ops runbook at `docs/operations/terraform.md`. |
| M4.8 | ✅ done | Trivy CRITICAL gate + CycloneDX SBOMs, distroless migration image, ESO templates (GCP + Azure switch), 13 NetworkPolicies opt-in with default-deny. |
| M4.9 | ✅ done | Opt-in compose profile (`--profile ssl`) with Nginx + Let's Encrypt auto-renewal sidecar. K8s path uses ingress-nginx + cert-manager instead. |
| M4.10 | ❎ Not pursued | Superseded by M4.7's DOKS provisioning + the Gjirafa-provided production cluster. See [M4.10 — Not pursued](#m410--not-pursued). |
| M4.11 | ✅ done | FastAPI webhook → Claude Haiku triage → Slack/Discord enriched notification, deployed as a chart workload. |
| M4.12 | ✅ done (docs split) | This document + [`../logs/m4-ai-logs.md`](../logs/m4-ai-logs.md). AI usage log authored separately. |

## Known Gaps at M4 close

Carrying into M5 / post-M4 cleanup. Tracked here so they aren't lost; cross-referenced in the individual entries' "Known follow-ups" sections.

- **Keycloak `KC_DB_URL` hardcoded.** Breaks under `postgres.enabled=false`. Either keep a minimal in-cluster Postgres for keycloak in managed-PG mode, or template `KC_DB_URL` from the `myproperty-postgres` Secret and create a `keycloak` DB + user on managed PG.
- **CD short-SHA bug.** `cd.yml` passes the full 40-char `${{ github.sha }}` but CI tags images with 7-char `SHORT_SHA`. Auto-deploys cannot pull the images CI just published — every "successful" deploy was actually manual.
- **`terraform apply` not in CI/CD.** Provisioning manual; CD assumes infra exists. PR-comment `plan` + gated `apply` is post-M4.
- **DNS, K8s Secrets, Postgres schema grants not in Terraform.** Each tracked as a discrete follow-up in M4.7's Known follow-ups.
- **TLS CA validation for managed PG.** `Trust Server Certificate=true` works while traffic stays inside the private VPC. Replace with `VerifyFull` + mounted DO CA bundle as a post-M4 hardening pass.
- **Trivy HIGH-severity blocking.** Currently HIGH is surfaced via SARIF but non-blocking. Flip once `.trivyignore` baseline has triaged the existing HIGH advisories.
- **ESO Workload Identity.** Bootstrap-secret auth works on DOKS; Workload Identity is the production-grade replacement on GKE / AKS. Not available on DOKS.
- **Promtail → non-root log shipper.** Last remaining PSS=restricted blocker. Vector + Loki sink is the lowest-friction path.
- **Image signing (cosign / sigstore).** Closes the "what proves this image was built by our CI" gap. Image-policy admission enforces at deploy time.
- **OCR table extraction (`PaymentReceiptOcr`).** M3 follow-up batched with M5 multi-tenancy migration.
- **IDOR existence leak (M3 audit).** Foreign payment ID returns 403 instead of 404; deferred to M5 after OWASP ZAP scan.
- **Nightly cluster teardown.** Cost-control automation; ~$3/day live, ~$90/month if forgotten. Wire a scheduled `terraform destroy` GHA with a manual approval gate.
