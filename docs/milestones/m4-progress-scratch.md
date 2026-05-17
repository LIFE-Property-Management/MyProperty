# M4 progress — scratch log

Accumulating raw progress entries during the M4 unblock sprint and main M4 deliverables. Final `docs/m4-infrastructure-mvp.md` is assembled from this file when the milestone ships on May 22.

---

## Sprint plan of record — M4 unblock sprint

**Window.** May 13 → ~May 15. Two to three days. Closes before M4 main deliverables begin.

**Why this sprint exists.** Most "M4 blockers" in `docs/audits/m3-m4/audit/dev-prod-gaps.md` are application-code changes, not DevOps work. If the application code is not fixed first, the DevOps teammate starts building Docker Compose / Dockerfiles / Helm / CI-CD against an app that produces CORS errors, redirect loops, missing env vars, and Keycloak auth failures the moment containers come up on separate origins. That is a guaranteed stall. This sprint runs ahead of the DevOps work to remove those failures, so the DevOps teammate begins against an app that already behaves correctly in a multi-origin, reverse-proxied, container-deployed setup.

**Scope — 9 items from `docs/audits/m3-m4-audit/dev-prod-gaps.md`.**

| Group | Items | Owner | Status at sprint start |
|---|---|---|---|
| Origin & routing (backend) | C1, H7, A1 backend | Erdi | Open |
| Frontend build-time config | F1, F2, A2 (`.dockerignore`) | Erdi | Open |
| Realm config | A6, E5 (decision-only this sprint) | Erdi + DevOps | A6 done; A1 realm done; E5 decision pending |
| K8s readiness | H1 (readiness probe) | Erdi | Open |
| Migration bundle | D2 | Erdi (artifact); DevOps (K8s wiring) | Open |

Detail per item — fix shape, risk, and dependencies — lives in `docs/audits/dev-prod-gaps.md`. This file is the execution log, not the spec.

**Out of scope.** Anything not in the 9 items above. In particular: Anthropic OCR retry hardening (H2), RabbitMQ correlation ID propagation (L3), Redis fallback strategy (H4), brute-force protection (A4), Postgres pool tuning (D3), rate-limit boundary tests (C2), multi-tenancy retrofit, OWASP ZAP findings, IDOR existence leak. All deferred to M4 main work or M5.

**Sprint exit criteria — verification gate.** When all 9 items are closed, a multi-container `docker compose up` succeeds and a browser at `http://localhost:3000` can:
1. Reach `http://localhost:5042/api/v1/health/live` without CORS errors.
2. Initiate Keycloak login without redirect URI rejection.
3. Complete a JWT-authenticated API call end-to-end.
4. Have no `.env.local` content baked into the frontend production image.

When all four pass, message DevOps teammate that app-code blockers are cleared and M4 main deliverables are green-lit.

**Decisions already made (do not re-litigate during the sprint).**
- Loki + Grafana stays. No migration to ELK. Will document the deviation in the M5 architecture doc.
- Multi-tenancy work is deferred to M5. Global-query-filter retrofit during M4 risks breaking the Docker / Helm / CI work.
- OCR table extraction (`PaymentReceiptOcr`) deferred to M5, batched with multi-tenancy migration.
- IDOR existence leak (foreign payment ID → 403 instead of 404) deferred to M5 — fixing it after the OWASP ZAP scan produces a better paper trail.
- CI/CD scope is lint → test → build → push. "Deploy via pipeline" is out of scope; manual `helm upgrade` for the demo is acceptable.
- K8s deployment target is the real cluster provided by Gjirafa. No local kind / k3d / minikube.
- Linear stays as the project board.

**Order of execution within the sprint.**
1. **Plan 1 — backend origin & routing** (C1, H7, A1 backend). Most likely to surface unknowns; ships first. *Completed 2026-05-13.*
2. **Plan 2 — frontend build-time config** (F1, F2, A2). One decision (Docker build-arg injection for `NEXT_PUBLIC_*`) executed twice plus a static `.dockerignore` file.
3. **Plan 3 — realm + decision items** (A6 verification, E5 decision). A6 is already shipped on this branch; E5 is a documented decision for DevOps teammate, no code.
4. **Plan 4 — K8s readiness** (H1).
5. **Plan 5 — migration bundle artifact** (D2 artifact; K8s integration is DevOps teammate's M4 work).

Each plan is scoped to be reviewable as a single commit and verifiable against a concrete curl / build / test command.

---

### 2026-05-13 — M4 unblock sprint, Plan 2 (F1, F2, A2)

**Scope.** Frontend build-time config for Docker deployment + Docker build context hygiene.

**Changes.**
- `frontend/lib/utils/env.ts` (new) — `requirePublicEnv()` helper using a typed lookup-table of literal `process.env.NEXT_PUBLIC_*` reads (turbopack/webpack only inline literal property accesses; dynamic `process.env[name]` defeats static analysis). Throws in production builds when a required var is missing; warns in dev.
- `frontend/lib/api/client.ts` — replaced silent `process.env` fallback with `requirePublicEnv("NEXT_PUBLIC_API_BASE_URL")`. Updated comment to reflect prod-fatal behavior.
- `frontend/lib/auth/keycloak.ts` — replaced three `process.env.NEXT_PUBLIC_*!` non-null assertions in `getInstance()` with `requirePublicEnv()` calls.
- `frontend/.env.local.example` — added build-time vs runtime header, prod-shape placeholder URLs (`*.myproperty.PLACEHOLDER.example`), documented `NEXT_PUBLIC_API_BASE_URL` as dev-optional / prod-required.
- `frontend/.dockerignore` (new) — excludes `.env*` (critically `.env.local` containing `NEXT_PUBLIC_DEV_AUTH_BYPASS=true`), `node_modules`, `.next`, test dirs, IDE configs. Does **not** exclude `mocks/` or `public/mockServiceWorker.js` because both tenant and dashboard layouts unconditionally import `@/mocks/MockProvider` (audit item F3); MSW remains a no-op in prod via the `NODE_ENV !== "development"` check inside `MockProvider`. Cleaner stripping deferred post-M4.
- `backend/.dockerignore` (new) — excludes `bin/`, `obj/`, test project, `appsettings.Development.json`, IDE configs, `.env*`.
- `frontend/Dockerfile` (new) — verification-grade multi-stage build. Header explicitly marks it as not production-ready; DevOps owner hardens (standalone output, non-root user, healthcheck, base image pinning) before deployment.

**Verification.**
- `npx tsc --noEmit` clean.
- Docker build with `--build-arg NEXT_PUBLIC_API_BASE_URL=https://api.verify-test.example` succeeded. Bundle grep returned matches in three chunk files showing the URL inlined as a string literal: `NEXT_PUBLIC_API_BASE_URL:()=>"https://api.verify-test.example"`. Same for `NEXT_PUBLIC_KEYCLOAK_URL`. Confirms turbopack static replacement is reaching the client bundle.
- Docker build WITHOUT build args failed during Next.js prerender of `/tenant/dashboard` with the exact `requirePublicEnv` error message — confirms the runtime guard works as defense-in-depth at SSG time.
- First verification pass exposed a bug in the original `requirePublicEnv` implementation: dynamic `process.env[name]` access defeats Next.js's static replacement and leaves the var as an undefined runtime lookup in the client bundle. Restructured the helper to use a lookup table of literal accesses; re-verified.

**Side note — npm audit fix.** Bumped axios, next.js, and postcss inside the same working branch to close 13 high-severity axios CVEs, 14 high-severity Next.js advisories, and 1 moderate postcss issue. `npm audit` now reports 0 vulnerabilities. Next.js bumped from 16.2.3 to 16.2.6 (unrelated to the env-inlining issue, which is intentional bundler behavior not a regression).

**M3 grade impact.** None directly — these were M4 prep items. Removes the silent-failure mode that would have made any first Docker deploy land with broken API calls + Keycloak. Also closes a likely M5 security finding (axios CVEs).

**Sprint progress.** 6 of 9 M4 blockers closed (Plan 1: C1, H7, A1 backend; Plan 2: F1, F2, A2).

---

### 2026-05-16 — M4 unblock sprint, Plan 3 (A6, E5)

**Scope.** Keycloak realm production-readiness: deployable realm config (A6) and a runtime spec for `start --import-realm` mode (E5).

**Changes.**
- `infrastructure/keycloak/realm-export.json` → `realm-export.template.json`. The two URL spots inside the `myproperty-frontend` client (`redirectUris`, `webOrigins`) now use `${MYPROPERTY_FRONTEND_BASE_URL}`. Localhost and the Plan 1 placeholder `https://myproperty.PLACEHOLDER.example` both removed from the template — single source of truth via the env var. The Plan 1 audience mapper (`audience-myproperty-api`) survives intact.
- `docker-compose.yml` — new `keycloak-realm-init` service (`alpine:3.20`, runs `envsubst` once, exits) plus new `keycloak_import` named volume. Keycloak service updated: import dir is now the named volume (not a host bind mount), `depends_on` adds `keycloak-realm-init: service_completed_successfully`, env block gets `MYPROPERTY_FRONTEND_BASE_URL` with `http://localhost:3000` default.
- `docker-compose.yml` — healthcheck swapped from `curl` to an inline Java probe (compiles `HealthCheck.java` to `/tmp` on first run, uses the bundled JRE to GET the realm well-known endpoint). The curl-based probe has almost certainly been silently failing since the Keycloak 26 image stripped curl from its UBI Micro base; verified before the swap that the container had been stuck in `health: starting` indefinitely.
- `infrastructure/keycloak/PRODUCTION.md` — new doc for the DevOps teammate. Covers: why `start-dev` is dev-only, the full env-var checklist for `start --import-realm` (`KC_HOSTNAME`, `KC_PROXY_HEADERS=xforwarded`, `KC_HTTP_ENABLED=true`, `KC_HOSTNAME_STRICT=true`, plus DB/admin/IdP secrets), the init-container pattern translated to a Helm-shaped K8s example, URL conventions (public vs cluster-internal, with the JWT issuer-vs-authority mismatch gotcha called out), the realm-import-on-first-startup behavior with operational implications, and a recommendation to use Keycloak's native `/health/live`+`/health/ready` on port 9000 for K8s probes rather than copying the dev compose Java probe.
- Old `infrastructure/keycloak/realm-export.json` deleted — eliminates the trap where a future bind-mount addition would pull in two competing realm files.

**Verification.**
- **G1** (template structure): `jq` confirmed both URL spots use the placeholder var, audience mapper present, bearer-only `myproperty-api` client present, zero occurrences of `myproperty.PLACEHOLDER.example` or `localhost:3000` literals in the template.
- **G2** (`docker compose config`): exit 0.
- **G3** (clean boot from empty DB): after dropping the keycloak DB + named volume and `docker compose up -d keycloak`, the container reached `Up (healthy)` within the start_period — the Java healthcheck works where curl had been failing silently for the entire prior sprint.
- **G4** (init pipeline): `keycloak-realm-init` exited 0, logged the success message, the rendered `realm-export.json` was present in `/opt/keycloak/data/import/` inside the Keycloak container with `http://localhost:3000` substituted in place of the env-var placeholder (dev default applied).
- **G5** (realm endpoint): `GET /realms/MyProperty/.well-known/openid-configuration` returned issuer `http://localhost:8080/realms/MyProperty`.
- **G6** (env-var override): re-rendering with `MYPROPERTY_FRONTEND_BASE_URL=https://staging.example.com` flowed the override into the produced JSON — proves the prod path actually works without needing to stand up a prod-mode harness locally.
- **G7** (integration tests): 28/28 pass. Audience validation from Plan 1 still intact; the realm changes don't touch the `MyPropertyTest` fixture realm.
- **G8** (doc readability): PRODUCTION.md reads top-to-bottom as a standalone deploy spec.

**Side note — healthcheck bug closed as a side-benefit.** The audit didn't flag the broken curl healthcheck (it was reading source statically; couldn't observe that the runtime exec was failing). Caught it mid-planning by inspecting `docker compose ps keycloak` — container stuck in `health: starting` indefinitely. Since the plan was already modifying the keycloak service block for the init-container wiring, replacing the probe in the same commit was nearly free. Worth noting because it means M4 demo grading on `docker compose ps` will now show Keycloak as `(healthy)` rather than ambiguous-state.

**M3 grade impact.** A6 was an M4 blocker per the audit; E5 was an M4 blocker for the K8s deployment specifically. Both close cleanly. The healthcheck fix isn't audit-graded but eliminates a "why is Keycloak stuck in starting" question if a grader inspects the local stack.

**Sprint progress.** 7 of 9 M4 blockers closed. Remaining: H1 (readiness health probe — Plan 4) and D2 (EF migration bundle in CI/CD — Plan 5).

---

### 2026-05-17 — M4.1 Docker Compose (full stack)

**Scope.** Bring every service in the M4.1 deliverable onto a single `docker compose up`: Next.js + .NET API + PostgreSQL + Redis + Keycloak + RabbitMQ + monitoring stack (Loki + Promtail + Prometheus + Grafana). MailHog (dev SMTP catcher) stays, since the existing M3.7 invite flow depends on it.

**Changes.**
- `backend/Dockerfile` (new) — multi-stage .NET 10 build. `sdk:10.0` restores the four-project graph from individual `*.csproj` copies (cache-friendly), then `dotnet publish` produces a self-contained Release output; `aspnet:10.0` is the runtime base with `curl` added for the compose-level `/api/v1/health/live` probe. Build context is `backend/` so the existing `backend/.dockerignore` applies as-is (no repo-root `.dockerignore` needed). M4.2 hardens (non-root user, chiseled base, Trivy, pinned digests, HEALTHCHECK directive).
- `backend/MyProperty.Api/Options/KeycloakOptions.cs` — added optional `MetadataAddress`. Authority remains required (used as default `ValidIssuer`); `MetadataAddress` overrides the OIDC discovery URL when set.
- `backend/MyProperty.Api/Program.cs` — when `Keycloak:MetadataAddress` is configured, set `JwtBearerOptions.MetadataAddress` on the bearer scheme. Without this split, the API container can't reach `http://localhost:8080/.well-known/...` to fetch the JWKS (localhost inside the container is the container itself), while tokens issued through the browser carry `iss=http://localhost:8080/realms/MyProperty` (the browser-facing URL). The split lets Authority stay the public URL (for issuer validation) and MetadataAddress point at the cluster-internal Keycloak service name. `infrastructure/keycloak/PRODUCTION.md` already documented this as the "advanced configuration" path; M4.1 was where we needed it.
- `backend/MyProperty.Api/HealthChecks/KeycloakJwksHealthCheck.cs` — derive the JWKS URL from `MetadataAddress` when set, falling back to Authority. Without the fix, the diagnostic probe self-hit `localhost:8080` (the API's own port) and got back 401 from the default auth fallback policy — false negative every run. Caught while validating `/api/v1/health/diagnostics` end-to-end (see G3 below).
- `docker-compose.yml` — added four services:
  - `backend` (image `myproperty-api:dev`, host port 5042 → container 8080). Env-var-driven config: every `appsettings.Development.json` value that referenced `localhost` is overridden with the cluster-internal service name (`postgres`, `redis`, `rabbitmq`, `mailhog`, `keycloak`, `loki`). Authority/MetadataAddress split as described above. `depends_on` waits for Postgres + Redis + RabbitMQ + Keycloak healthchecks. `/api/v1/health/live` is the Docker healthcheck via curl.
  - `frontend` (image `myproperty-frontend:dev`, host port 3000). `NEXT_PUBLIC_*` build args wired from `${KEYCLOAK_PUBLIC_URL}`, `${NEXT_PUBLIC_API_BASE_URL}` etc. — defaults to the localhost shape so `docker compose up` works on a clean clone. `depends_on: backend` (service_started, not healthy — frontend doesn't need a runtime API to serve the static bundle).
  - `prometheus` (host port 9090). Scrapes itself + `backend:8080/metrics`. The API doesn't expose `/metrics` yet — M4.5 wires the exporter — so the target reports "down" until then. Kept the scrape job to make the wiring visible at demo time.
  - `promtail` (no host port). Bind-mounts `/var/lib/docker/containers` and `/var/run/docker.sock` to ship every container's stdout/stderr to Loki. Compose project + service labels become Loki labels (verified: `container`, `compose_project`, `compose_service`, `service_name`, `logstream`, `app`).
  - Grafana datasource provisioning expanded with `prometheus.yaml` alongside existing `loki.yaml`.
- `infrastructure/prometheus/prometheus.yml` (new) — minimal scrape config; self + API target.
- `infrastructure/promtail/config.yml` (new) — Docker SD pipeline, relabel rules for container/compose labels.
- `infrastructure/grafana/provisioning/datasources/prometheus.yaml` (new) — Grafana sees Prometheus alongside Loki on startup.
- `.env.example` — documented the new compose vars (`FRONTEND_PUBLIC_URL`, `KEYCLOAK_PUBLIC_URL`, `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_KEYCLOAK_REALM`, `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID`, `ANTHROPIC_API_KEY`). Every variable has a compose-level default so the file is purely override / documentation; a fresh clone runs `docker compose up` without touching `.env`.

**Decisions.**
- **JWKS metadata split over hosts-file workaround.** The alternative was asking developers to add `127.0.0.1 keycloak` to their host's hosts file so browser + backend share a single URL. Rejected: per-developer setup, OS-specific instructions, and easy to forget. The MetadataAddress option is the path `infrastructure/keycloak/PRODUCTION.md` already documents for production split networks, so dev and prod use the same mechanism.
- **Browser-direct API calls (with CORS).** The existing `Cors__AllowedOrigins__0` config gates `http://localhost:3000`; tokens still issued by Keycloak at `http://localhost:8080` go straight to the backend at `http://localhost:5042`. Proxying through Next.js (rewrite rules / Route Handlers) was rejected for M4.1 — it would require frontend code changes and SignalR WebSocket proxy wiring, outside scope.
- **Backend Dockerfile build context = `backend/`** (not the repo root). Matches `frontend/Dockerfile` which uses `frontend/`. Means the existing `backend/.dockerignore` applies unchanged; no repo-root `.dockerignore` needed.
- **`curl` installed in the .NET runtime stage.** `aspnet:10.0` (Debian 12 slim) ships neither curl nor wget. Adding curl (~2 MB) for the compose-level HTTP probe is the cheapest fix; M4.2 swaps to a chiseled / distroless runtime where the healthcheck moves out of the image entirely and into the orchestrator (Helm probe in K8s).
- **Loki + Promtail stays; no ELK.** Decision already on record (line 36 of this scratch log; M3 backend CLAUDE.md). DO-6 calls for ELK; we document the deviation in the M5 architecture doc and ship the equivalent Loki-side capability.
- **MailHog kept in the stack.** Not in the M4.1 deliverable list explicitly, but the existing M3.7 invite flow + Smtp__Host config point to it, and removing it would break the dev demo of invite acceptance. Trivial inclusion (single container, no host resources).

**Verification.**
- **G1** (`docker compose config --quiet` exits 0). Confirmed after fixing one YAML parser snag — values with internal colons (URLs, `myproperty:dev:` cache prefix, `Host=postgres;Port=5432;...` connection string) were initially unquoted; YAML treats `key: value:more` as a nested mapping. Quoted every environment value defensively; compose now resolves cleanly.
- **G2** (`docker compose build backend`). Cold cache: ~10 s for restore stage, ~6 s for publish stage. NuGet graph for the four-project solution restores from individual csproj COPYs — incremental rebuilds on source-only changes skip restore.
- **G3** (`docker compose build frontend`). ~25 s. Used the existing verification-grade `frontend/Dockerfile` (Plan 2 from the unblock sprint) unchanged. Confirmed `NEXT_PUBLIC_*` build args land in the bundle as already verified in the unblock-sprint log.
- **G4** (`docker compose up -d`). All 11 containers reach `running`; 10 of 11 report `healthy` (Promtail has no healthcheck defined — by design, it's an unattended log shipper without a `/ready` endpoint exposed in its default image).
- **G5** (backend health probes from the host):
  - `GET /api/v1/health/live` → 200 (empty entries).
  - `GET /api/v1/health/ready` → 200 with Postgres listed as Healthy.
  - `GET /api/v1/health/diagnostics` → 200 with Postgres + Redis + RabbitMQ + Keycloak-JWKS all `Healthy`. Proves the JWKS metadata split works (Keycloak is reachable from inside the API container via `http://keycloak:8080`) and proves the health-check fix landed correctly (without it, the JWKS check self-hit localhost:8080 and got 401).
- **G6** (browser-facing services): `curl -o /dev/null -w '%{http_code}'` returns 200 from all of: `http://localhost:3000/` (Next.js), `http://localhost:8080/realms/MyProperty/.well-known/openid-configuration` (Keycloak well-known with `issuer=http://localhost:8080/realms/MyProperty` — matches token iss claim), `http://localhost:15672/api/overview` (RabbitMQ management UI), `http://localhost:8025/` (MailHog), `http://localhost:3100/ready` (Loki), `http://localhost:9090/-/ready` (Prometheus), `http://localhost:3001/api/health` (Grafana).
- **G7** (Grafana datasource provisioning). `GET /api/datasources` returns both `Loki` (uid=loki, isDefault) and `Prometheus` (uid=prometheus) — provisioning files picked up on first boot.
- **G8** (Loki ingestion via Promtail). `GET /loki/api/v1/labels` returns `["app","compose_project","compose_service","container","logstream","service_name"]` — labels populated from the relabel pipeline; proves Promtail is shipping container stdout/stderr to Loki within seconds of stack start.
- **G9** (Prometheus discovery). `GET /api/v1/targets` shows `myproperty-api` registered at `backend:8080`. State will read `down` until M4.5 adds the /metrics exporter to the .NET service.

**Side note — backend healthcheck false negative.** The JWKS diagnostic probe was self-hitting localhost:8080 inside the API container (its own port, returning 401 via the default-deny auth fallback). Without the M4.1 work, this was masked because Authority and the local listener used the same URL — the bug only surfaces once the Authority/MetadataAddress split exists. Fix is in the same PR because the failure mode and the fix are part of the same architectural change.

**M4.1 status.** Closed. The seven services from the deliverable text (Next.js + .NET + PostgreSQL + Redis + Keycloak + RabbitMQ + monitoring stack) all run from a single `docker compose up`. Monitoring stack covers logs (Loki + Promtail) and metrics (Prometheus); dashboards (M4.5) and alerts (M4.5 + M4.11) follow on top of this foundation.

**M4 deliverable progress.** 1 of 12. Remaining for M4 main work: M4.2 (production Dockerfiles), M4.3 (CI/CD pipeline), M4.4 (K8s + Helm), M4.5 (monitoring dashboards + alerts), M4.6 (Uptime Kuma), M4.7 (Terraform), M4.8 (security hardening), M4.9 (Nginx + SSL), M4.10 (Linux server), M4.11 (AIOps), M4.12 (AI Log Entry #4).

**Known deviation logged.** `AnthropicOcrOptions` is defined in `Application/Common/Ocr/` and registered via `AddAiServices` in Infrastructure — violates the options-in-Api convention. Tracked for post-M4 cleanup in backend `CLAUDE.md`.

---