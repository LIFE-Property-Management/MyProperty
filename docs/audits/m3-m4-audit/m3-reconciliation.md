# M3 Reconciliation — actual code state vs progress log

Audit date: 2026-05-11  
Auditor: Claude Code (claude-sonnet-4-6)  
Scope: every deliverable in the Deliverable Status table at the bottom of `docs/milestones/m3-backend-mvp.md`, plus the three deep-dive items and the frontend contract gap.

---

## Verified accurate

The following deliverables match the doc claims with no meaningful gaps.

| ID | What was verified |
|---|---|
| **M3.1** | Invite flow (4 endpoints, token model, CQRS folder layout, lease-at-acceptance) and payment state machine (4 handlers, 4 endpoints, state guards, resource-scoped authz, cache invalidation) are all wired in code exactly as described in the progress log. |
| **M3.2** | Keycloak JWT, `KeycloakRolesTransformer`, `FallbackPolicy = RequireAuthenticatedUser`, `ICurrentUser` / `HttpContextCurrentUser`, `MeController`, Google SSO — all present. `ValidateAudience = false` TODO still in `Program.cs:97-107` with loud comment (accurately flagged in doc). `RequireHttpsMetadata = !IsDevelopment()` (accurately described). |
| **M3.3** | PostgreSQL 16 via EF Core 10. 7 migrations applied. `BaseEntity` with `AuditingInterceptor`, soft-delete global query filter, entity configurations in `Infrastructure/Persistence/Configurations/`. |
| **M3.4** | `docs/performance/m3-sql-optimization/` contains `benchmark.sql`, `seed.sql`, `results.txt`. Migration `20260504095019_AddOverduePaymentsPartialIndex` ships the partial index. Speedup claims (Q1 ~22×, Q2 ~103×, Q3 ~13×) are supported by the results file. |
| **M3.7** | `SendEmailJob` with `[AutomaticRetry(Attempts=5, DelaysInSeconds=[30,120,600,1800,3600])]`. `EmailDeadLetterFilter` writes to `failed_emails` table on final failure. Hangfire backed by PostgreSQL, dashboard at `/hangfire` behind `AdminOnlyDashboardFilter`. |
| **M3.9** | `IFileStorage` in Application. `LocalFileStorage` in Infrastructure (`receipts/{yyyy}/{MM}/{guid}{ext}`, path-traversal hardened). 5 MB FluentValidation cap + 6 MB Kestrel `[RequestSizeLimit]` hard cap. Multipart submit and lease-scoped download endpoints. `ReceiptFileKey` in `PaymentSubmittedEvent` payload. |
| **M3.11** | Test project at `backend/MyProperty.Tests/`. Unit folder covers validators, invite handlers, landlord-dashboard handler, `KeycloakRolesTransformer`, `HttpContextCurrentUser`, `CorrelationIdMiddleware`, `IntegrationEventNaming`. Integration folder covers health, authorization (anon → 401, garbage token → 401, role-correct → 200, cross-role → 403), invite flow, invite preview/reject, landlord dashboard. Real Keycloak via Testcontainers with JWKS validation. `IDistributedCache` → `MemoryDistributedCache`, `IBackgroundJobQueue` → `RecordingBackgroundJobQueue` as test substitutes. `RabbitMq:Enabled=false` keeps tests broker-free via `NullEventPublisher`. |
| **M3.12** | FluentValidation: 9 validators exist (5 invite/dashboard + 4 payment). `anon-invite` (per-IP 30/min) and `authenticated` (per-user 120/min, IP fallback) policies wired. `UseRateLimiter()` placed after `UseAuthorization()` so `sub` claim is available for partitioning. |
| **M3.13** | Serilog configured in `Program.cs` with bootstrap logger, console + Loki sink (Loki sink enabled when `LokiUrl` config present). `CorrelationIdMiddleware` runs before `UseSerilogRequestLogging()`. Loki + Grafana both in `docker-compose.yml` (Grafana on port 3001, Loki on 3100). |

---

## Updates needed (doc understates what shipped)

### M3.6 — hub and dispatcher shipped; doc still shows ⏳ open

The `M3.6` row in the status table reads `⏳ open` but the feature is substantially complete in code. Everything that shipped:

- `NotificationsHub` at `/hubs/notifications` (`MyProperty.Api/Hubs/NotificationsHub.cs`)
- JWT via `?access_token=` query string, lifted only for `/hubs/*` paths in `JwtBearerEvents.OnMessageReceived` (`Program.cs:113-126`)
- `INotificationDispatcher` interface in `Application/Common/Notifications/INotificationDispatcher.cs`
- `SignalRNotificationDispatcher` in `MyProperty.Api/Hubs/SignalRNotificationDispatcher.cs` — registered as singleton in `Program.cs:250`
- Redis backplane wired via `Microsoft.AspNetCore.SignalR.StackExchangeRedis` (channel prefix `myproperty.signalr`), toggled by `SignalR:UseRedisBackplane` (default `true`)
- Group key strategy: internal `User.Id` (from `IUserRepository.GetByKeycloakSubIdAsync`), **not** Keycloak `sub`. Hub resolves the internal id once per connection.
- 4 consumers via `IntegrationEventConsumerBase<TEvent>`: `PaymentConfirmedConsumer`, `PaymentSubmittedConsumer`, `PaymentRejectedConsumer`, `PaymentCreatedConsumer`
- Push events live: `PaymentConfirmed` → `tenant:{userId}`, `PaymentRejected` → `tenant:{userId}`, `PaymentCreated` → `tenant:{userId}`, `PaymentSubmitted` → `landlord:{userId}`

What is still missing from the original M3.6 scope (remaining genuinely open):

- `InviteAccepted` and `InviteRejected` push to landlord — no event records exist, no consumers registered, invite handlers do not inject `IEventPublisher`
- `LeaseExpiringSoon` push to tenant — no method on `INotificationDispatcher`, not called from any Hangfire job

The Decisions section in the doc also says "No Redis backplane" but the backplane is implemented and on by default — this reversal needs to be documented.

### M3.8 — all four payment events ship; doc says only PaymentConfirmed

The `M3.8` status note reads "Completed PaymentConfirmed Event flow. Others are for post M#" — this is significantly understated. Actual state:

- `CreatePaymentHandler` publishes `PaymentCreatedEvent` ✅
- `SubmitPaymentHandler` publishes `PaymentSubmittedEvent` (with `ReceiptFileKey`) ✅
- `ConfirmPaymentHandler` publishes `PaymentConfirmedEvent` ✅
- `RejectPaymentHandler` publishes `PaymentRejectedEvent` ✅
- Five consumers registered in `DependencyInjection.cs`: `PaymentConfirmedConsumer` (email + SignalR), `PaymentSubmittedConsumer` (SignalR), `PaymentSubmittedOcrConsumer` (Hangfire OCR job), `PaymentRejectedConsumer` (SignalR), `PaymentCreatedConsumer` (SignalR)

Still genuinely missing from the original M3.8 five-event scope: `InviteAccepted` and `InviteRejected` events — no event record types exist for these, and neither `AcceptInviteHandler` nor `RejectInviteHandler` inject `IEventPublisher`.

### M3.10 — OCR shipped; doc shows ⏳ open

The `M3.10` row reads `⏳ open` but the feature is fully implemented. (See deep-dive section below.)

### M3.15 — AI log exists; doc shows ⏳ open

The `M3.15` row reads `⏳ open` but `docs/logs/m3-ai-logs.md` exists and is complete. (See deep-dive section below.)

### M3.12 — doc understates validator count

The doc says "5 validators" but 9 exist: `CreateInvite`, `AcceptInvite`, `RejectInvite`, `GetInviteByToken`, `GetLandlordDashboard` (all mentioned) plus `CreatePayment`, `SubmitPayment`, `ConfirmPayment`, `RejectPayment` (added with Batches P1+P2 but not reflected in the M3.12 status note).

---

## Caveats not in the doc

### M3.5 — bench numbers never captured

`docs/performance/m3-redis-caching/README.md` shows `_TBD_` placeholders in the Headline Results table. The doc marks M3.5 as "✅ done" but the performance proof (the documented reason for the cache) has no concrete numbers. The bench harness (`docs/performance/m3-redis-caching/bench/`) is committed and runnable; it just was never executed against a live stack.

### M3.5 — README invalidation table is stale

The invalidation table in `docs/performance/m3-redis-caching/README.md` shows `SubmitPaymentHandler`, `ConfirmPaymentHandler`, and `RejectPaymentHandler` as "⏳ wire on creation". All three call `dashboardCache.InvalidateAsync(landlordId, ct)` in the shipped code. The README predates Batches P1+P2 and was not updated.

### M3.6 Decisions section is inconsistent with code

The Decisions section in `m3-backend-mvp.md` says "**No Redis backplane** — single API instance for the milestone". `Program.cs:252-264` wires the backplane by default (`SignalR:UseRedisBackplane` defaults to `true`). The decision was reversed during implementation but the Decisions section was not updated.

### M3.11 — payment code has zero test coverage

M3.9 batch note says "Receipt upload + download path is covered manually only." This is accurate but understates the gap: all four payment handlers (`CreatePayment`, `SubmitPayment`, `ConfirmPayment`, `RejectPayment`) have no unit tests. `DownloadReceiptHandler` has no test. `PaymentsController` has no integration test. The test project covers invites and the landlord dashboard only. If a validator or handler regression lands in payment code, the suite will not catch it.

### Mapperly never implemented — CLAUDE.md claim is aspirational

`backend/CLAUDE.md` says: "All entity ↔ DTO mapping uses Mapperly source generators." Mapperly is not in any `.csproj` file. No `[Mapper]` annotation exists anywhere in the codebase. Every handler constructs DTOs by hand (e.g. `new PaymentConfirmedDto(payment.Id, now)`). The CLAUDE.md comment about Mapperly describes the planned post-M3 retrofit, not the current state.

### ICurrentUser.Principal — acknowledged abstraction leak

`ICurrentUser.cs:40-44` carries a `// TODO post-M3: remove this leak` comment explaining that `ClaimsPrincipal? Principal` exists only because `IUserRepository.GetOrSyncFromClaimsAsync` takes one. The leak is present in production code. `AcceptInviteHandler` uses `currentUser.Principal!` (note the null-forgiving operator) — this will throw a `NullReferenceException` if `Principal` is null in any context where it isn't guaranteed (e.g. a future system-initiated call path).

### HashToken duplication

`CreateInviteHandler`, `AcceptInviteHandler`, `RejectInviteHandler`, `GetInviteByTokenHandler`, `InvitePreviewAndRejectTests.cs`, and `TestUtils/TokenHasher.cs` each carry an identical SHA256 hex implementation. The doc mentions this under Known Gaps; it remains unfixed.

### M3.2 audience validation TODO still open

`Program.cs:97-107` has a multi-line `TODO(M3.2 follow-up, before May 6)` comment. The May 6 target passed; `ValidateAudience = false` is still the live config. Any Keycloak-realm token (including tokens for unrelated clients) is accepted by this API.

---

## Discrepancies (doc claims something the code doesn't show)

### M3.6 scope (invite events) — not implemented at all

The Decisions section and `backend/CLAUDE.md` both describe `InviteAccepted` and `InviteRejected` events being published to a landlord's SignalR group. Neither event record type exists under `Application/Invites/Events/`. Neither `AcceptInviteHandler` nor `RejectInviteHandler` inject `IEventPublisher`. No consumers are registered. `INotificationDispatcher` has no method for invite notifications. The `IntegrationEventNamingTests.cs` defines a local `InviteAcceptedEvent` record for naming-convention testing only — it is not a real domain event.

### M3.6 scope (LeaseExpiringSoon) — not started

`backend/CLAUDE.md` documents a `LeaseExpiringSoon` event to be sent from a Hangfire scan. No such method exists on `INotificationDispatcher` or `SignalRNotificationDispatcher`. No Hangfire job fires this event.

### M3.8 scope (invite events) — not implemented

Same as above. The original M3.8 five-event list includes `InviteAccepted` and `InviteRejected`. Neither is published.

---

## Specific deep-dives

### M3.6 SignalR — what shipped

**Entry point:** `NotificationsHub` at `MyProperty.Api/Hubs/NotificationsHub.cs`, mapped in `Program.cs:344` via `app.MapHub<NotificationsHub>(NotificationsHub.Path)` where `Path = "/hubs/notifications"`.

**JWT auth:** `JwtBearerEvents.OnMessageReceived` in `Program.cs:114-126` lifts `?access_token=` into the bearer pipeline, restricted to paths starting with `/hubs` (REST endpoints are not affected).

**Group key strategy:** `OnConnectedAsync` calls `IUserRepository.GetByKeycloakSubIdAsync(sub)` to resolve the **internal `User.Id`** (not the Keycloak `sub`). Group names: `TenantGroup(userId) = "tenant:{userId}"`, `LandlordGroup(userId) = "landlord:{userId}"`. A connection with no matching user row is aborted with a log line (`"client should hit REST first"`).

**INotificationDispatcher / SignalRNotificationDispatcher:** The interface lives in `Application/Common/Notifications/INotificationDispatcher.cs` (four methods: `NotifyTenantPaymentConfirmedAsync`, `NotifyTenantPaymentRejectedAsync`, `NotifyTenantPaymentCreatedAsync`, `NotifyLandlordPaymentSubmittedAsync`). The implementation wraps `IHubContext<NotificationsHub>` in `MyProperty.Api/Hubs/SignalRNotificationDispatcher.cs`. Transport errors are caught and logged so a flaky backplane never fails a consumer's ack. Registered as singleton in `Program.cs:250`.

**Consumers using IntegrationEventConsumerBase<TEvent>:** Four consumers (not counting `PaymentSubmittedOcrConsumer` which goes to Hangfire, not SignalR):
- `PaymentConfirmedConsumer` — routing key `payment.confirmed`, queue `myproperty.payment.confirmed.email` — calls `INotificationDispatcher.NotifyTenantPaymentConfirmedAsync` and enqueues email via `IBackgroundJobQueue`
- `PaymentSubmittedConsumer` — routing key `payment.submitted`, queue `myproperty.payment.submitted.signalr` — calls `NotifyLandlordPaymentSubmittedAsync`
- `PaymentRejectedConsumer` — routing key `payment.rejected`, queue `myproperty.payment.rejected.signalr` — calls `NotifyTenantPaymentRejectedAsync`
- `PaymentCreatedConsumer` — routing key `payment.created`, queue `myproperty.payment.created.signalr` — calls `NotifyTenantPaymentCreatedAsync`

**Redis backplane:** wired via `AddStackExchangeRedis` against `Cache:RedisConnection` with channel prefix `myproperty.signalr`. Toggle: `SignalR:UseRedisBackplane` (default `true`). Integration suite sets it to `false` (Testcontainers has no Redis service).

**What's missing from original M3.6 scope:**
- `InviteAccepted` / `InviteRejected` push to landlord — no event types, no consumers, no dispatcher methods, not published from invite handlers
- `LeaseExpiringSoon` push to tenant — no dispatcher method, no Hangfire job

---

### M3.10 Receipt OCR — what shipped

**AI provider:** Anthropic vision API (`https://api.anthropic.com/v1/messages`). Model: `claude-sonnet-4-5-20250929` (default in `AnthropicOcrOptions`; overridable via `Anthropic:Model` config).

**Service interface:** `IReceiptOcrService` in `Application/Common/Interfaces/IReceiptOcrService.cs`. Single method: `ExtractAsync(Stream image, string contentType, CancellationToken ct) → ReceiptOcrResult`.

**Implementation:** `AnthropicReceiptOcrService` in `Infrastructure/Ai/AnthropicReceiptOcrService.cs`. Registered via `AddHttpClient<IReceiptOcrService, AnthropicReceiptOcrService>()` (named HttpClient with configurable timeout, default 30s). Sends a base64-encoded image in a `messages` request, parses JSON response for `amount`, `date`, `merchant`. Handles HTTP errors, JSON parse failures, network errors, and timeouts gracefully — all return `ReceiptOcrResult` with null fields and an error code string rather than throwing. Stub mode when `Anthropic:ApiKey` is null or empty (logs once, returns `OCR_DISABLED_NO_API_KEY`).

**Call chain:** `SubmitPaymentHandler` publishes `PaymentSubmittedEvent` (with `ReceiptFileKey` in payload) → RabbitMQ → `PaymentSubmittedOcrConsumer` (queue `myproperty.payment.submitted.ocr`) → skips if `ReceiptFileKey` is null (manual cash submissions) → `IBackgroundJobQueue.EnqueueReceiptOcr(paymentId)` → `ReceiptOcrJob.ExecuteAsync(paymentId)` → downloads file from `IFileStorage`, calls `IReceiptOcrService.ExtractAsync`, writes results back to `Payment` row, saves.

**Result storage:** 5 nullable columns on the `Payment` entity (not a separate table):
- `OcrAmount decimal?`
- `OcrDate DateOnly?`
- `OcrMerchant string?`
- `OcrProcessedAt DateTime?`
- `OcrRawResponse string?` (unbounded text)

Migration `20260508221203_AddPaymentOcrColumns` adds all five columns. The post-M3 follow-up note in the doc (extract to `PaymentReceiptOcr` table) is documented but not implemented.

**Config keys:**
- `Anthropic:ApiKey` — required for live OCR; absent enables stub mode
- `Anthropic:Model` — defaults to `claude-sonnet-4-5-20250929`
- `Anthropic:TimeoutSeconds` — defaults to 30; used to set `HttpClient.Timeout`

**Idempotency guard:** `ReceiptOcrJob` checks `payment.OcrProcessedAt is not null` before processing — re-enqueued jobs skip silently.

---

### M3.15 AI Log #3 — what shipped

**File:** `docs/logs/m3-ai-logs.md` — exists and is committed.

**Entry count:** 14 entries, correctly grouped:
- API generation: entries 1–4 (scaffold, payment handlers, RabbitMQ wiring, SignalR hub)
- Query optimization: entries 5–7 (Q1 EXPLAIN analysis, Q2 partial-index diagnosis, M3.5 cache-aside design)
- Debugging: entries 8–11 (`TreatWarningsAsErrors` fixes, RabbitMQ v7 API mismatch, layering violation diagnosis, Testcontainers Docker-not-running)
- Security: entries 12–14 (Keycloak auth model, rate-limit token-enumeration design, SignalR `?access_token=` security review)

**Gitignore anchoring:** `.gitignore` contains `/logs/` (leading slash = anchored to repo root). This rule matches `<repo-root>/logs/` only, not `docs/logs/`. `docs/logs/m3-ai-logs.md` is tracked by git.

**Status table in doc:** `M3.15 | ⏳ open` — this is wrong. The deliverable is complete.

---

## Frontend contract status

**`docs/api-contract.md` does not exist.** The only reference to it is in `m3-backend-mvp.md:86`: "see `docs/api-contract.md` (to be written)".

**Current de-facto contract source of truth:**

| Layer | What exists | Status |
|---|---|---|
| Backend | Swagger at `/swagger` (dev/staging). Controller routes and `[ProducesResponseType]` attributes. | Present but not exported or shared |
| Frontend | `frontend/lib/api/endpoints.ts` | **Mismatched** — see below |
| Shared | Nothing | Missing |

**Critical mismatch between `endpoints.ts` and actual backend routes:**

The frontend `endpoints.ts` uses MSW mock-handler paths, not the real backend paths:

| Frontend endpoint | Real backend path | Match? |
|---|---|---|
| `/me` | `GET /api/v1/me` | Prefix mismatch |
| `/tenant/me` | (no equivalent endpoint exists) | No match |
| `/tenant/lease` | (no equivalent endpoint exists) | No match |
| `/tenant/payments/current` | (no equivalent endpoint exists) | No match |
| `/tenant/payments/history` | (no equivalent endpoint exists) | No match |
| `/tenant/payments/receipt` | (no equivalent endpoint exists) | No match |
| `/invites/${token}` | `GET /api/v1/invites/by-token/{token}` | Path and method differ |
| `/invites/${token}/accept` | `POST /api/v1/invites/{token}/accept` | Prefix mismatch |
| `/landlord/dashboard` | `GET /api/v1/landlord/dashboard` | Prefix mismatch |
| `/landlord/payments/upcoming` | (no equivalent endpoint exists) | No match |

The frontend routes were designed for MSW interception during UI development (MSW matches relative paths; `NEXT_PUBLIC_API_BASE_URL` is left unset in dev so requests don't escape). The backend exposes a completely different URL tree under `/api/v1/`. Half the frontend endpoint keys have no backend implementation at all (tenant-specific views, payment current/history queries, upcoming payments).

**Impact on M5 "FE-BE integration complete":** There is currently no path from the frontend to the real backend without:
1. A full endpoint-path alignment (backend adds new endpoints or frontend endpoint keys are rewritten)
2. An axios/fetch base-URL rewrite from MSW-relative to `/api/v1/`-prefixed
3. Backend implementations for missing tenant-specific views (current payment, payment history, lease summary, upcoming payments)

Grading FE-BE integration (FS-2) is not possible without `api-contract.md` or the equivalent Swagger export. The Swagger doc at `/swagger` is the de facto contract right now, but it is only visible in dev/staging, not exportable or version-controlled.
