# Dev → Prod gap audit

Audited: 2026-05-11  
Branch: `develop`  
Scope: backend + frontend source, `docker-compose.yml`, appsettings, .env files, Keycloak realm export  
Methodology: read-only static analysis — no code was changed.

---

## Summary

**29 items found.** Of these:

| Category | Count |
|---|---|
| Blockers for M4 demo / CI / Docker prod build | 9 |
| Security findings (graded in M5) | 9 |
| Resilience / observability gaps (graded in M5) | 7 |
| Cosmetic / "should fix eventually" | 4 |

---

## Auth gaps

| # | Location | Issue | Risk | Fix shape | M4 blocker? |
|---|---|---|---|---|---|
| A1 | `backend/MyProperty.Api/Program.cs:105` | `ValidateAudience = false` — explicit TODO comment, missed May 6 deadline. Any token signed by the realm (including tokens minted for unrelated Keycloak clients) is accepted by this API. | High — cross-client token reuse possible | Add audience mapper to `myproperty-api` client in realm-export.json; set `ValidateAudience = true, ValidAudience = "myproperty-api"` | No — runs in dev, but is an M5 security grade point |
| A2 | `frontend/.env.local:5` | `NEXT_PUBLIC_DEV_AUTH_BYPASS=true` is set in the developer's working `.env.local`. `NEXT_PUBLIC_*` values are **baked into the Next.js bundle at build time**. If a Docker prod build runs `next build` with this file present in the build context (no `.dockerignore` exists yet), the bypass is permanently embedded. Both `KeycloakInit.tsx` files only emit a `console.warn` when bypass is active in a production build — they do not block it. | Critical if `.dockerignore` is absent — prod users would log in without Keycloak | Create `.dockerignore` excluding `.env.local`, `.env`; verify CI build doesn't inherit developer files | **Yes** — `.dockerignore` must exist before first Docker build |
| A3 | `frontend/app/dashboard/_components/KeycloakInit.tsx:26–32` and `frontend/app/(tenant)/_components/KeycloakInit.tsx:26–32` | Dev-bypass fixture identities (`sub: "dev-landlord"` / `sub: "dev-tenant"`, `email: "landlord@dev.local"`) are hardcoded. When active the UI shows as authenticated but any real API call will fail JWT validation (no actual bearer token). | Low in isolation — backend correctly rejects unsigned calls; risk is confusion or accidental CI test with bypass on | No code change needed once `.dockerignore` + CI env hygiene are in place | Conditional (see A2) |
| A4 | `infrastructure/keycloak/realm-export.json` | `bruteForceProtected: false` — Keycloak realm has brute-force protection disabled. | Medium — credential stuffing against the Keycloak `/token` endpoint is unthrottled | Set `bruteForceProtected: true` + configure thresholds in realm-export.json | No — dev-only impact |
| A5 | `infrastructure/keycloak/realm-export.json` | `myproperty-frontend` client has `directAccessGrantsEnabled: true` (Resource Owner Password Grant). This is needed only for the integration test fixture, which uses a separate `MyPropertyTest` realm. Production realm has it enabled unnecessarily. | Low-medium — ROPC grant is deprecated by OAuth 2.1; less secure than PKCE | Set to `false` in the production realm; integration tests use `MyPropertyTest` and are unaffected | No |
| A6 | `infrastructure/keycloak/realm-export.json` | `redirectUris: ["http://localhost:3000/*"]` — only localhost is whitelisted. Any OAuth2 redirect from a production or staging domain will be rejected by Keycloak. | M4 blocker — SSO callback will 400 on any deployed environment | Add prod/staging domain URI to `redirectUris` in realm config (or provision separate realm configs per environment) | **Yes** |
| A7 | `backend/MyProperty.Api/Program.cs:94` | `RequireHttpsMetadata = !builder.Environment.IsDevelopment()` — correctly gated. Test factory sets env to `Development` specifically for this reason. | None — works as designed. Documented in both CLAUDE.md and test fixture. | No action needed | No |

---

## Secrets and configuration

| # | Location | Issue | Risk | Fix shape | M4 blocker? |
|---|---|---|---|---|---|
| S1 | `docker-compose.yml:9–11` | `POSTGRES_PASSWORD: postgres` (same password re-used at line 34 for Keycloak's DB URL). Weak default committed in source. | Low in dev; high if the same compose file is used unmodified for a staging/prod deployment | Use environment variable substitution (`${POSTGRES_PASSWORD}`) and require it to be set; document in `.env.example` | No — but must not reach prod |
| S2 | `docker-compose.yml:30–31` | `KEYCLOAK_ADMIN: admin` / `KEYCLOAK_ADMIN_PASSWORD: admin123` hardcoded. | High if compose file reaches prod — anyone can access the Keycloak admin console | Replace with `${KEYCLOAK_ADMIN_PASSWORD}` substitution | No — M4 Helm/K8s configs must use secrets |
| S3 | `docker-compose.yml:77–78` | `RABBITMQ_DEFAULT_USER: guest` / `RABBITMQ_DEFAULT_PASS: guest`. RabbitMQ restricts `guest` to `localhost` by default, but if the management port (15672) is exposed, this is still a risk. | Medium | Replace with secrets-backed variables | No |
| S4 | `docker-compose.yml:37` | `GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-GOOGLE_CLIENT_ID_PLACEHOLDER}` — fallback placeholder means Google SSO silently misconfigures rather than failing. | Medium — Google IdP will be broken at runtime with no error at Keycloak startup | Remove the default placeholder; require the variable to be set explicitly | No |
| S5 | `backend/MyProperty.Api/appsettings.json:3–5` | `Keycloak:Authority: ""` and `ConnectionStrings:Postgres: ""` and `Cache:RedisConnection: ""` are empty strings. This is correct (secrets come from user-secrets / env vars), **but** there is no documented CI/CD secret manifest for M4 to reference. | Medium — pipeline will fail at startup without explicit documentation of required env vars | Create a `required-env-vars.md` or CI secrets template documenting every key that must be injected | **Yes** — pipeline will have unexplained startup failures otherwise |
| S6 | `backend/MyProperty.Api/appsettings.json` | `Anthropic:ApiKey` is absent entirely (only `Model` and `TimeoutSeconds` are present). `AnthropicOcrOptions.ApiKey` is `string?` with no `[Required]` — startup succeeds even without the key. OCR silently degrades to stub mode. | Low for availability (graceful), but prod will have receipt OCR silently disabled until the key is provided. | Add an explicit note to CI secrets template; consider a startup warning log at `Warning` level (currently only warns once via `Interlocked.CompareExchange`) | No |
| S7 | `frontend/.env.local.example:12` | `.env.local.example` is committed with `NEXT_PUBLIC_API_BASE_URL=http://localhost:5042` as the default value. The actual `.env.local` has this line **commented out** — so in dev, API calls use relative URLs and MSW intercepts them. CI/prod builds need this variable set explicitly or Next.js will make calls to relative paths, which won't reach the backend container. | **M4 blocker** — frontend requests in Docker will 404 | Set `NEXT_PUBLIC_API_BASE_URL` as a build arg or env var in the Dockerfile / K8s deployment | **Yes** |

---

## External service substitutions

| # | Location | Issue | Risk | Fix shape | M4 blocker? |
|---|---|---|---|---|---|
| E1 | `docker-compose.yml:93–106` and `backend/MyProperty.Api/appsettings.Development.json:13–19` | **MailHog** is the SMTP target in dev (`Host: localhost, Port: 1025, UseStartTls: false`). Production needs a real SMTP service (SendGrid, SES, etc.) with `UseStartTls: true`. `SmtpOptions` has `ValidateDataAnnotations().ValidateOnStart()` which will crash startup if `Host` is empty — good — but there is **no validation enforcing `UseStartTls=true` in non-Development environments**. A misconfigured prod SMTP with `UseStartTls=false` sends email in cleartext. | Medium — silent cleartext email in prod if someone copies dev config | Add an explicit startup check or documentation note that `UseStartTls` must be `true` in all deployed environments | No |
| E2 | `backend/MyProperty.Infrastructure/DependencyInjection.cs:68` | `LocalFileStorage` is hardcoded as the only `IFileStorage` implementation (`services.AddSingleton<IFileStorage, LocalFileStorage>()`). `FileStorage:LocalRoot` defaults to `../../storage` in dev. In a Docker container, this resolves relative to the working directory inside the container (typically `/app`), giving `/storage` or a path that **does not survive container restart** without a mounted volume. | **M4 blocker** — uploaded receipts are lost on container restart unless a volume is explicitly mounted | Must mount a persistent volume at the container path and set `FileStorage__LocalRoot` accordingly in Docker Compose / Helm | **Yes** |
| E3 | `backend/MyProperty.Tests/Integration/Fixtures/MyPropertyApiFactory.cs:74–75` | Integration tests substitute `IDistributedCache` with `MemoryDistributedCache` (correctly). This bypasses Redis entirely — Redis-specific behaviors (distributed key expiry, key prefix collisions, serialization differences) are not exercised by the test suite. | Low for M4; could mask Redis-specific bugs | Acceptable trade-off per CLAUDE.md; document that Redis-specific behaviors require a manual smoke test | No |
| E4 | `frontend/mocks/MockProvider.tsx:11` | **MSW (Mock Service Worker)** is correctly gated: `process.env.NODE_ENV !== "development"` — in a production Next.js build (`NODE_ENV=production`), `ready` is `true` immediately and `worker.start()` is never called. The service worker file (`public/mockServiceWorker.js`) is present in the repo and would be served as a static asset in production (harmless, never registered). | Low — no functional risk; minor information disclosure (exposes MSW presence to anyone who reads the static file listing) | Remove `public/mockServiceWorker.js` from the production Docker image via `.dockerignore`, or accept as low-risk | No |
| E5 | `docker-compose.yml:29` | Keycloak uses `command: ["start-dev", "--import-realm"]`. `start-dev` disables production security constraints (hostname validation, HTTPS enforcement, strict client checks). It is explicitly documented as dev-only by Keycloak. The Helm/K8s M4 deployment must use `start --import-realm` (Keycloak 26.x supports `--import-realm` in production mode). | **M4 blocker** for the K8s deployment — `start-dev` is not suitable for any deployed environment | Change Keycloak command to `start --import-realm` in prod Helm values; add `KC_HOSTNAME`, `KC_PROXY=edge` (or `passthrough`) for Nginx TLS termination | **Yes** (for K8s) |

---

## Logging / observability

| # | Location | Issue | Risk | Fix shape | M4 blocker? |
|---|---|---|---|---|---|
| L1 | `backend/MyProperty.Api/Program.cs:69–78` | Loki sink is optional (guarded by `!string.IsNullOrWhiteSpace(lokiUrl)`). Without `LokiUrl` set, logs go to console only — no aggregation, no query, no dashboards. `appsettings.json` has no `LokiUrl` key (it only appears in `appsettings.Development.json`). | Medium — prod Docker build will have console-only logs unless `LokiUrl` is explicitly set | Add `LokiUrl: ""` as a documented key in `appsettings.json`; include in prod env secrets template | No — but must be in M4 Docker Compose / Helm configs |
| L2 | `docker-compose.yml:131–133` | Grafana has `GF_AUTH_ANONYMOUS_ENABLED: "true"` with `GF_AUTH_ANONYMOUS_ORG_ROLE: Admin`. The file itself has a comment `# NOTE: anonymous admin is enabled — local demo only, not suitable for production.` | **Critical if used as-is in any deployed env** — public Grafana Admin access | These env vars must be removed / overridden in any non-local compose file or Helm values. Grafana should require login in staging/prod. | **Yes** (for M4 Docker Compose that graders will access) |
| L3 | `backend/MyProperty.Infrastructure/Messaging/Consumers/IntegrationEventConsumerBase.cs:177` | `HandleAsync` is called with `CancellationToken.None`, and there is no code extracting a correlation ID from RabbitMQ message headers and pushing it into Serilog `LogContext`. Consumer log entries (`"Failed to handle {EventType}"`, etc.) have no trace back to the originating HTTP request. | Medium — distributed tracing is broken across the async boundary; hard to debug production incidents | Extract correlation ID from `ea.BasicProperties.CorrelationId`, push to `LogContext.PushProperty("CorrelationId", ...)` inside `OnMessageAsync` | No |
| L4 | `backend/MyProperty.Api/Program.cs:75` | `batchPostingLimit: builder.Environment.IsDevelopment() ? 1 : 100` — In non-dev environments, the Loki sink batches 100 log entries before posting. If Loki is unreachable, the `Serilog.Sinks.Grafana.Loki` sink buffers internally and retries silently. There is no circuit-breaker or `selfLog` wired to expose Loki delivery failures in the console output. | Low — app won't crash; some logs may be silently dropped during Loki downtime | Enable `Serilog.Debugging.SelfLog.Enable(Console.Error)` in prod to surface sink errors | No |

---

## Health and resilience

| # | Location | Issue | Risk | Fix shape | M4 blocker? |
|---|---|---|---|---|---|
| H1 | `backend/MyProperty.Api/Controllers/V1/HealthController.cs` | **Liveness probe only** — `GET /api/v1/health` returns `{ status: "ok" }` unconditionally if the process is alive. It does **not** check downstream dependencies (Postgres connectivity, Redis PING, RabbitMQ broker, Keycloak JWKS reachability). In Kubernetes, a readiness probe against this endpoint will route traffic to a pod with a broken DB connection until requests start failing. | High for K8s reliability — pod restarts / rolling deploys won't isolate broken pods | Add `IHealthCheck` implementations for Postgres, Redis, RabbitMQ (using `AddNpgsql`, `AddRedis`, `AddRabbitMQ` from `AspNetCore.HealthChecks.*` packages); expose `GET /api/v1/health/ready` as the K8s readiness target | No for M4 demo; required before K8s prod |
| H2 | `backend/MyProperty.Infrastructure/Ai/AnthropicReceiptOcrService.cs` | **No retry on Anthropic API calls.** `httpClient.SendAsync` is called once; transient 429 or 5xx returns `OCR_NETWORK_ERROR` to the caller. The Hangfire OCR job (`ReceiptOcrJob`) that invokes this has its own Hangfire retry, but the default retry policy on the OCR job is not documented in code — only `SendEmailJob` has explicit `[AutomaticRetry(Attempts=5)]`. | Low — OCR gracefully degrades; user sees pre-fill fields empty | Add `[AutomaticRetry(Attempts=3)]` to `ReceiptOcrJob`; optionally add `AddTransientHttpErrorPolicy` on the `HttpClient` | No |
| H3 | `backend/MyProperty.Infrastructure/Messaging/Consumers/IntegrationEventConsumerBase.cs:43` | RabbitMQ reconnect uses a **flat 5-second delay** with no exponential backoff or jitter. After a broker restart in prod, all consumers reconnect simultaneously, potentially causing a thundering herd on the broker. | Low for single-node dev; Medium for multi-pod K8s deployment | Replace `ConnectRetryDelay` with exponential backoff + jitter (e.g., `TimeSpan.FromSeconds(Math.Min(300, 5 * Math.Pow(2, retryCount))) + jitter`) | No |
| H4 | `backend/MyProperty.Infrastructure/DependencyInjection.cs:121–126` | **No Redis fallback strategy.** `AddStackExchangeRedisCache` is wired unconditionally when Redis connection config is present. If Redis becomes unreachable at runtime, `IDistributedCache` operations throw `RedisConnectionException`, causing `GetLandlordDashboardHandler` to fail rather than serve uncached data. | Medium — landlord dashboard is unavailable during Redis outages | Wrap cache reads in try/catch in `RedisLandlordDashboardCache`; fall back to calling the repository directly on cache miss/error | No |
| H5 | `backend/MyProperty.Infrastructure/DependencyInjection.cs:176–181` | `options.WorkerCount = Environment.ProcessorCount * 2` — in Docker containers, `Environment.ProcessorCount` returns the **host** CPU count before cgroups limits are applied (a known .NET behavior prior to .NET 6 container-aware builds; fixed in .NET 7+ for Linux). .NET 10 should read the cgroup limit correctly, but this was not verified. If the container is given a 1-CPU limit, Hangfire will still configure 2 workers. | Low — over-provisioning workers, not under; minor memory overhead | Make configurable: `configuration.GetValue("Hangfire:WorkerCount", Environment.ProcessorCount * 2)` | No |
| H6 | `backend/MyProperty.Infrastructure/Messaging/Consumers/IntegrationEventConsumerBase.cs:176` | `HandleAsync(evt, scope.ServiceProvider, CancellationToken.None)` — `CancellationToken.None` is passed to every handler. During graceful host shutdown, `stoppingToken` is cancelled, but in-progress message handling ignores it. The `StopAsync` override (line 188) closes the channel, which can race with in-flight `HandleAsync` calls. | Low — short in-flight time; worst case is a nack + requeue | Pass `stoppingToken` into `HandleAsync`; gate the `OnMessageAsync` subscription on `!stoppingToken.IsCancellationRequested` | No |
| H7 | `backend/MyProperty.Api/Program.cs:332` | `app.UseHttpsRedirection()` is unconditional. Behind **Nginx SSL termination** (M4 deliverable), the pod receives plain HTTP from Nginx. Without `app.UseForwardedHeaders()` configured to trust `X-Forwarded-Proto`, the middleware sees HTTP and issues a 301 redirect to `https://<host>:<port>`. The redirect port is the Kestrel HTTP port, not 443, causing a broken redirect loop. | **M4 blocker** — all API requests through Nginx will redirect instead of being served | Add `app.UseForwardedHeaders(new ForwardedHeadersOptions { ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto })` before `UseHttpsRedirection`; gate `UseHttpsRedirection` on `!env.IsDevelopment()` or configure it to respect forwarded scheme | **Yes** |

---

## Frontend

| # | Location | Issue | Risk | Fix shape | M4 blocker? |
|---|---|---|---|---|---|
| F1 | `frontend/.env.local:3` (commented out) | `NEXT_PUBLIC_API_BASE_URL` is **commented out** in `.env.local`. Dev design intent: leave unset so MSW intercepts relative-URL calls. But in Docker/K8s, frontend and backend containers have **different origins** — relative URLs hit the Next.js server, not the API. Without this variable set in the prod build, every TanStack Query call silently 404s. | **M4 blocker** | Set `NEXT_PUBLIC_API_BASE_URL` as a Docker build arg or K8s config map entry pointing to the backend service URL (or Nginx proxy path) | **Yes** |
| F2 | `frontend/.env.local:4` | `NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8080` — baked into the browser bundle at build time. In Docker/K8s, browsers resolve this URL from the client machine, not from within the container network. `localhost:8080` is unreachable from a browser hitting a remote deployment. | **M4 blocker** | Set to a publicly-routable Keycloak URL (e.g., `https://auth.myproperty.app`) as a Docker build arg | **Yes** |
| F3 | `frontend/app/(tenant)/layout.tsx:5` and `frontend/app/dashboard/layout.tsx:3` | Both layouts unconditionally import and render `MockProvider`. In `NODE_ENV=production` `MockProvider` is a transparent passthrough (returns children immediately without starting the worker). This is functionally safe but adds a React client boundary and a dynamic import attempt (`await import("./browser")`) that is dead-code at runtime. | Cosmetic / negligible runtime cost | Tree-shaken import or conditional render; not worth doing before M4 | No |
| F4 | `frontend/mocks/handlers.ts` | MSW handlers intercept **relative paths** (`/me`, `/tenant/lease`, etc.). If any developer sets `NEXT_PUBLIC_API_BASE_URL` in their local `.env.local` to an absolute URL (e.g., for testing against a real backend), MSW silently stops intercepting — calls go straight through and hit the real backend. This isn't a prod risk but is a confusing dev experience with no warning. | Low | Document in `.env.local.example` that MSW only works when `NEXT_PUBLIC_API_BASE_URL` is unset | No |

---

## Database

| # | Location | Issue | Risk | Fix shape | M4 blocker? |
|---|---|---|---|---|---|
| D1 | `backend/MyProperty.Infrastructure/Persistence/` | `Database.Migrate()` is **not** called from `Program.cs` — correctly compliant with CLAUDE.md rule. Only `ApiFixture.cs` (test code) calls `MigrateAsync()`. ✓ No issue. | — | — | — |
| D2 | _(no CI/CD files exist yet)_ | **No migration bundle workflow exists.** CLAUDE.md states migrations should be applied via a migration bundle in CI/CD, never from `Program.cs`. M4 must produce: (1) `dotnet ef migrations bundle` step in the pipeline, (2) a migration init-container or job in Helm, (3) documentation of the migration run order relative to pod startup. Without this, every prod deployment requires a manual migration run. | **M4 blocker** — rolling deployments in K8s will start new pods against un-migrated schema | Create a K8s init-container using the EF migration bundle; wire it as a Helm pre-upgrade hook | **Yes** |
| D3 | `backend/MyProperty.Api/appsettings.Development.json:4` | Postgres connection string has no `CommandTimeout`, `MaxPoolSize`, or `MinPoolSize` params. Npgsql defaults: `MaxPoolSize=100`, `CommandTimeout=30s`. Under K8s with multiple pods, each pod opens up to 100 connections — with 3 pods that's 300 connections against a single Postgres instance. PgBouncer or explicit pool size cap is needed. | Low for M4 demo (1–2 pods); Medium for any load test | Add `MaxPoolSize=20;MinPoolSize=2;CommandTimeout=30` to the connection string; document in prod secrets template | No — note for M4 planning |
| D4 | `backend/MyProperty.Api/appsettings.json:38–39` | `FileStorage:LocalRoot: ""` — `[Required, MinLength(1)]` on `FileStorageOptions` means startup **fails fast** if this is unset in prod. This is correct fail-fast behavior, but there is no production default, and the key is absent from all documented CI/CD secrets templates (which don't exist yet). | Low — fails fast rather than silently | Add `FileStorage__LocalRoot=/app/storage` to the prod env secrets template; mount a persistent volume at `/app/storage` in K8s | **Yes** (covered by E2 above) |

---

## CORS / rate limiting / request size

| # | Location | Issue | Risk | Fix shape | M4 blocker? |
|---|---|---|---|---|---|
| C1 | `backend/MyProperty.Api/Program.cs` (absent) | **No CORS policy is configured anywhere in the backend.** There is no `AddCors` / `UseCors` call. In a same-origin deployment (frontend and backend served from the same Nginx domain) this is invisible. In a Docker Compose or K8s deployment where the frontend container (port 3000) and API container (port 5042) are on different origins, **browsers will block all cross-origin requests** with a CORS error on every TanStack Query call. | **M4 blocker** — first Docker run with separate containers will produce zero working API calls from the browser | Add `builder.Services.AddCors(...)` with a named policy; apply `app.UseCors(...)` in the pipeline. Policy should be strict: list specific allowed origins from config rather than `AllowAnyOrigin`. | **Yes** |
| C2 | `backend/MyProperty.Api/Program.cs:170–200` | Rate-limiting policies are configured and `UseRateLimiter()` is applied. However, **no integration test exercises the 429 path** — the test suite never sends enough requests to trigger either `anon-invite` (30 req/min) or `authenticated` (120 req/min) policies. | Low — policies are correctly defined; tests won't hit limits at 101-test scale. No prod impact. | Add a rate-limit boundary test to verify the 429 response shape | No |
| C3 | `backend/MyProperty.Api/Controllers/V1/PaymentsController.cs:65` | `[RequestSizeLimit(6MB)]` is applied only on the receipt submit endpoint. No global Kestrel override — default is 30 MB for all other endpoints. This is the stated design (single upload endpoint). ✓ No issue for M4. | — | — | — |

---

## Recommended fix order

Priority rationale: items are ordered by (1) whether they will cause M4 demo to fail on first run, (2) security grade impact for M5, (3) implementation cost.

| Priority | Item | Rationale |
|---|---|---|
| **1** | **C1 — Add CORS policy** | Day-one blocker: every browser API call will fail with CORS error the moment frontend and backend are separate containers. Zero-day fix. |
| **2** | **F1 — Set `NEXT_PUBLIC_API_BASE_URL` in prod build config** | Without this, all TanStack Query calls 404 silently in Docker. Required alongside CORS fix. |
| **3** | **H7 — Add `UseForwardedHeaders()`, gate `UseHttpsRedirection`** | Without forwarded headers, every Nginx-proxied request will get a redirect loop instead of a response. Cheap one-liner that unblocks all Nginx+SSL testing. |
| **4** | **F2 — Set `NEXT_PUBLIC_KEYCLOAK_URL` to prod-reachable URL** | Keycloak init fails silently in browsers; users can't log in. Required alongside CORS and API URL fix. |
| **5** | **A6 — Add prod domain to Keycloak `redirectUris`** | OAuth2 login callback will be rejected by Keycloak for any non-localhost origin. Must be done before any end-to-end auth test in Docker. |
| **6** | **A2 / S (create `.dockerignore`)** | Prevents `.env.local` (containing `NEXT_PUBLIC_DEV_AUTH_BYPASS=true`) from entering the Docker build context. Cheap file to create; eliminates a production auth bypass risk. Also excludes `storage/`, `.env`, user-secrets. |
| **7** | **D2 — Create migration bundle CI/CD step + K8s init-container** | Without this, schema and pods start in an undefined order. Blocking for any rolling deploy or CI integration test against a fresh cluster. |
| **8** | **E5 — Switch Keycloak to `start` (production mode) in prod configs** | `start-dev` violates Keycloak's own guidance for non-local use; disables hostname enforcement and HTTPS requirements that M5 security reviewers will check. |
| **9** | **A1 — Enable `ValidateAudience = true`** | Explicitly flagged as a TODO with an overdue date. Cross-client token acceptance is a clear M5 security finding. Low code risk; requires one realm config change + two `Program.cs` lines. |
| **10** | **H1 — Add readiness health probe** | Required before K8s pod scheduling is meaningful. Without it, pods with broken DB connections receive live traffic. Add Postgres + Redis checks; expose `/api/v1/health/ready` distinct from the existing liveness endpoint. |

Items not in the top 10 but cheap and worth batching with the above:
- **L2** (remove Grafana anonymous admin from any non-local compose file) — one env var deletion; should be done in the same commit as Docker Compose prod file creation.
- **S5** (create a required-env-vars reference doc) — pure documentation, no code; eliminates pipeline startup mysteries.
- **A4** (enable Keycloak brute force protection in realm config) — one JSON field change in realm-export.json.
