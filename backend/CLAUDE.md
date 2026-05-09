# MyProperty Backend — CLAUDE.md

## Stack
.NET 10 · C# · Clean Architecture · EF Core 10 · PostgreSQL 16 · Keycloak · Hangfire · RabbitMQ · SignalR · Redis · MailKit · Serilog → Loki → Grafana · FluentValidation · Mapperly · xUnit + WebApplicationFactory + Testcontainers · OpenAI/Anthropic (receipt OCR)

## Solution Layout

Four projects live under `backend/` (plus a fifth test project added at M3.11):

```
backend/
├── MyProperty.Api/              ← entry point; controllers, Program.cs, middleware, Swagger
├── MyProperty.Application/      ← use cases (commands/queries/handlers), DTOs, validators, interfaces
├── MyProperty.Domain/           ← entities, enums, value objects, domain rules. Pure C#, zero dependencies
├── MyProperty.Infrastructure/   ← EF Core DbContext, repository impls, MailKit, Keycloak client, file storage
└── MyProperty.Tests/            ← xUnit + WebApplicationFactory + Testcontainers (added M3.11)
```

`MyProperty.sln` lives at the repo root and references all projects via `backend/<Project>/<Project>.csproj`.

### Dependency rules (strict — do not violate)

```
Api ──► Application ──► Domain
 │                       ▲
 └─► Infrastructure ─────┘
            │
            └─► Application (for interfaces)
```

- `Domain` depends on **nothing**.
- `Application` depends on `Domain` only.
- `Infrastructure` depends on `Application` and `Domain`.
- `Api` depends on `Application` and `Infrastructure`.
- **Never** add an EF Core, ASP.NET, or external library reference to `Domain` or `Application`. If you find yourself wanting to, the design is wrong — define an interface in `Application` and implement it in `Infrastructure`.

## Architecture Patterns

### CQRS (without MediatR)
Use cases are organized as commands (state changes) and queries (reads), each in its own folder with handler classes called directly from controllers.

```
Application/Payments/
├── Commands/
│   ├── SubmitPayment/
│   │   ├── SubmitPaymentCommand.cs
│   │   ├── SubmitPaymentHandler.cs
│   │   └── SubmitPaymentValidator.cs
│   └── ConfirmPayment/
│       ├── ConfirmPaymentCommand.cs
│       └── ConfirmPaymentHandler.cs
└── Queries/
    └── GetPaymentHistory/
        ├── GetPaymentHistoryQuery.cs
        ├── GetPaymentHistoryHandler.cs
        └── PaymentHistoryDto.cs
```

- Commands are records: `public record SubmitPaymentCommand(Guid LeaseId, decimal Amount, ...);`
- Handlers are scoped services with a single `Handle(command, CancellationToken)` method.
- Controllers inject handlers directly via constructor — no mediator, no `_mediator.Send()`.
- **Decision:** MediatR was deliberately not adopted. Reasons: (1) the indirection hides where code runs, (2) MediatR moved to a paid commercial license in 2024, (3) we get the organizational benefits of CQRS without it. If we ever want pipeline behaviors, refactoring is mechanical.

### Repositories — thin, per-aggregate, no generic base
- One repository per aggregate root: `IPaymentRepository`, `ILeaseRepository`, `ITenantRepository`, `IInviteRepository`.
- Interfaces live in `Application/Common/Interfaces/`, implementations in `Infrastructure/Persistence/Repositories/`.
- Methods named for use cases (`GetPendingForLandlord`, `GetOverdueAsOf`), not CRUD primitives.
- **No** generic `IRepository<T>` base class — generic repositories leak `IQueryable` and defeat the purpose.
- Repositories return materialized results (`List<T>`, `T?`), not `IQueryable<T>`. Composing queries belongs inside the repository, not at the call site.

### Mapping — Mapperly
- All entity ↔ DTO mapping uses [Mapperly](https://mapperly.riok.app/) source generators.
- One mapper per aggregate, in `Application/<Feature>/Mappers/`.
- Compile-time generated, zero reflection. Mapping errors surface at build time.
- **Do not** add AutoMapper.

```csharp
[Mapper]
public partial class PaymentMapper
{
    public partial PaymentDto ToDto(Payment payment);
    public partial List<PaymentDto> ToDtoList(IEnumerable<Payment> payments);
}
```

## Domain

### Base entity
Every persisted entity inherits from `BaseEntity`:

```csharp
public abstract class BaseEntity
{
    public Guid Id { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? DeletedAt { get; set; }     // null = active
    public string? CreatedBy { get; set; }       // user ID (sub claim from JWT)
    public string? UpdatedBy { get; set; }
}
```

- Audit fields (`CreatedAt`, `UpdatedAt`, `CreatedBy`, `UpdatedBy`) are populated by an EF Core `SaveChangesInterceptor` — **never set them in handlers or services**.
- Soft delete: handlers set `DeletedAt = DateTime.UtcNow` instead of calling `Remove()`. A global query filter on `DbContext` excludes rows where `DeletedAt != null`.
- `CreatedBy`/`UpdatedBy` are read from `IHttpContextAccessor` inside the interceptor.

### Entity rules from the domain
- **Tenants with any prior active lease are never hard-deleted.** Post-lease accounts persist with read-only access — enforced at the authorization layer, not by deletion. See `docs/portals.md`.
- **Orphaned invites** (invite never opened, no lease, Keycloak account never activated) are auto-deleted after 30 days by a Hangfire job. This is a hard delete, not soft — orphans have no business records to preserve.
- **Landlord has final authority over payment confirmation.** The state machine for `Payment.Status` (`Outstanding → Pending → Confirmed | Rejected`) is enforced server-side. No client request can transition a payment to `Confirmed`; only landlord-authenticated `ConfirmPayment` commands can.

## API

### Conventions
- **Versioning:** URL-based — all endpoints prefixed `/api/v1/`. Use `Asp.Versioning.Http` + `Asp.Versioning.Mvc.ApiExplorer`.
- **Documentation:** Swagger/OpenAPI at `/swagger`, generated from XML comments + attributes. Enable in Development and Staging.
- **Error responses:** RFC 7807 Problem Details. Use `builder.Services.AddProblemDetails()` and a global `IExceptionHandler` that maps domain exceptions (`NotFoundException`, `ValidationException`, `ForbiddenException`) to appropriate `ProblemDetails` responses with `type` URIs under `https://myproperty.app/errors/`.
- **Pagination:** all list endpoints accept `?page=1&pageSize=20`. Response envelope: `{ items: [], page, pageSize, totalCount, totalPages }`.
- **Validation:** FluentValidation on every command/query. Validators run via a thin pipeline filter that converts `ValidationException` → 400 with `ValidationProblemDetails`.
- **Rate limiting:** `Microsoft.AspNetCore.RateLimiting` on all public-facing endpoints (auth, invite acceptance). Authenticated endpoints have a higher per-user limit.

### Controllers
- Thin. Inject handlers, deserialize input into command/query, call `Handle`, return result. No business logic.
- Action methods return `ActionResult<T>` or `IActionResult`.
- Always async, always accept `CancellationToken` and pass it through.

```csharp
[ApiController]
[Route("api/v1/payments")]
[Authorize(Roles = "Tenant")]
public class PaymentsController(SubmitPaymentHandler submit) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<PaymentDto>> Submit(
        SubmitPaymentCommand cmd, CancellationToken ct)
        => Ok(await submit.Handle(cmd, ct));
}
```

## Auth

- **Keycloak** runs in Docker. JWT bearer tokens validated by ASP.NET Core's JWT middleware against Keycloak's JWKS endpoint.
- **Roles:** `Tenant`, `Landlord`, `Admin`. Mapped from Keycloak realm roles into the JWT `realm_access.roles` claim, then projected onto ASP.NET Core's role claims via `TokenValidationParameters.RoleClaimType` config.
- **Authorization:** policy-based. Define policies in `Program.cs` (`RequireLandlord`, `RequireTenant`, `RequireAdmin`, plus resource-scoped policies like `LandlordOwnsProperty`).
- **OAuth2 SSO:** Google identity provider configured in Keycloak realm. Users sign in with Google through Keycloak; the API only ever sees Keycloak-issued JWTs.
- **Tenants cannot self-register.** Account creation only via the invite flow (see `docs/portals.md`). API enforces this: there is no public registration endpoint.
- **Invite flow:** invite tokens are signed, single-use, with `Expired` status after 7 days. Lease acceptance UI is presented before Keycloak account creation.

## Database

- **PostgreSQL 16** via EF Core 10. Connection string from `ConnectionStrings:Postgres` config.
- **Migrations:** code-first. Generate with `dotnet ef migrations add <Name> -p MyProperty.Infrastructure -s MyProperty.Api`. Apply via migration bundle in CI/CD; never call `Database.Migrate()` from `Program.cs` in production.
- **DbContext** lives in `Infrastructure/Persistence/AppDbContext.cs`. Entity configurations in `Infrastructure/Persistence/Configurations/<Entity>Configuration.cs` using `IEntityTypeConfiguration<T>`. **No** fluent API in the DbContext itself.
- **Soft deletes** via global query filter on `BaseEntity`-derived entities.
- **Indexes:** add explicitly in entity configurations. Required indexes (initial set):
    - `Payment(LeaseId, Status)` — dashboard queries
    - `Payment(DueDate) WHERE Status = 'Outstanding' AND DeletedAt IS NULL` — partial index for the recurring overdue-scan job. The unfiltered `(DueDate)` was demonstrably *slower* than no index (~74% of rows match `DueDate < today` so the planner walked nearly the whole table); the partial form covers ~24% of rows and answers the job's filter from the index alone. See `docs/performance/m3-sql-optimization/`.
    - `Lease(LandlordId, Status)` — landlord dashboards
    - `Invite(Token)` unique — invite lookup
    - `Invite(ExpiresAt)` — orphan cleanup job
- **N+1 prevention:** every query that loads related data uses `.Include()` or projection (`.Select()`). The three slowest queries were profiled with `EXPLAIN (ANALYZE, BUFFERS)` for M3.4 — see `docs/performance/m3-sql-optimization/README.md`.

## Caching

- **Redis** via `StackExchange.Redis` + `IDistributedCache`.
- **Cache-aside pattern.** Initial target: `GetLandlordDashboardQuery` — the dashboard aggregates property/tenant/payment counts and is hit on every landlord page load.
- Cache key convention: `{entity}:{id}:{view}` e.g., `landlord:{landlordId}:dashboard`.
- TTL: 60s for dashboard data; invalidate on relevant writes (payment submitted, lease created).
- Document before/after timings for M3.5 deliverable.

## Background Jobs (Hangfire)

- Hangfire with Postgres storage. Dashboard mounted at `/hangfire`, protected by `Admin` policy.
- Jobs:
    - **Send invite email** — fired from `CreateInviteHandler`. Retry policy: 5 attempts with exponential backoff. Dead-letter to a `failed_emails` table after final failure.
    - **Mark expired invites** — recurring, every 1 hour. Sets `Status = Expired` on invites past `ExpiresAt`.
    - **Orphan cleanup** — recurring, daily at 03:00 UTC. Deletes invites with `Status = Expired` and no associated lease, older than 30 days.
    - **Mark overdue payments** — recurring, daily at 00:05 UTC. Computes overdue status from `DueDate` and `Status`.
- Jobs live in `Infrastructure/Jobs/`. Each job is a class with a single `ExecuteAsync` method, registered as scoped.

## Message Queue (RabbitMQ)

- Events published end-to-end:
    - `PaymentSubmitted` — fired by `SubmitPaymentHandler` after the payment record is persisted. Consumer triggers OCR Hangfire job + SignalR push to landlord.
    - `PaymentConfirmed` / `PaymentRejected` — fired by `ConfirmPaymentHandler` / `RejectPaymentHandler`. Consumer triggers email Hangfire job + SignalR push to tenant.
    - `InviteAccepted` / `InviteRejected` — fired by the invite acceptance handlers. Consumer triggers SignalR push to landlord.
- Publishers live in handlers; consumers live in `Infrastructure/Messaging/Consumers/` as hosted services.
- **Pattern:** consumers do not contain business logic. They translate events into side effects: enqueue a Hangfire job (for retryable async work like email or OCR) and/or call `IHubContext<NotificationsHub>` to push a SignalR notification.
- Library: `RabbitMQ.Client` directly. No MassTransit — too heavy for our event volume.

### How RabbitMQ, Hangfire, and SignalR fit together

Each technology has a distinct role; do not blur them.

| Tech | Role | Example |
|---|---|---|
| **RabbitMQ** | Decouple event producers from consumers within the backend | `ConfirmPaymentHandler` publishes; an OCR consumer and a notification consumer both react |
| **Hangfire** | Retryable, persisted background work with DLQ | Send confirmation email (5 retries, exponential backoff) |
| **SignalR** | Push state changes from server to connected browsers | Notify tenant's browser that their payment was confirmed |

**Worked example — landlord confirms a payment:**

1. Landlord calls `POST /api/v1/payments/{id}/confirm`.
2. `ConfirmPaymentHandler` updates `Payment.Status = Confirmed`, saves to DB.
3. Handler publishes `PaymentConfirmedEvent` to RabbitMQ.
4. `PaymentConfirmedConsumer` receives the event, triggers two side effects:
    - Enqueues Hangfire job: send confirmation email to tenant.
    - Calls `IHubContext<NotificationsHub>.Clients.Group($"tenant:{tenantId}").SendAsync("PaymentConfirmed", payload)`.
5. Tenant's browser receives the SignalR event → invalidates the relevant TanStack Query → UI updates with fresh data from the API.

## Real-time (SignalR)

### Hub
- Single hub: `NotificationsHub` at `/hubs/notifications`, in `Api/Hubs/`.
- JWT bearer auth — same scheme as the REST API. Token passed via query string for the WebSocket handshake (SignalR's standard pattern; configure `JwtBearerEvents.OnMessageReceived` to read from `?access_token=` only for hub paths).
- On connect, the server places the connection into a group based on the authenticated user's role and ID:
    - Tenants → `tenant:{userId}`
    - Landlords → `landlord:{userId}`
- Clients **do not** choose their group — the server assigns it from the JWT `sub` claim. Tenants cannot join landlord groups and vice versa.
- The hub itself has **no client-callable methods** for business operations. All state changes still go through the REST API. The hub is server-push only.

### Events sent from server to clients

**To tenant connections (`tenant:{tenantId}`):**
- `PaymentConfirmed` — `{ paymentId, confirmedAt }`
- `PaymentRejected` — `{ paymentId, reason, rejectedAt }`
- `LeaseExpiringSoon` — `{ leaseId, expiresAt }` (fired by the recurring Hangfire scan)

**To landlord connections (`landlord:{landlordId}`):**
- `PaymentSubmitted` — `{ paymentId, tenantId, leaseId, amount, submittedAt }`
- `InviteAccepted` — `{ inviteId, tenantId, tenantName }`
- `InviteRejected` — `{ inviteId }`

### Push mechanics
- Notifications are pushed from RabbitMQ consumers, **not** directly from command handlers. Handlers publish events to RabbitMQ; consumers translate events into SignalR pushes. This keeps the API request path fast and decouples push delivery from the synchronous request lifecycle.
- Consumers depend on the **`INotificationDispatcher` abstraction** (in `Application/Common/Notifications/`), not directly on `IHubContext<NotificationsHub>`. The Api layer registers a `SignalRNotificationDispatcher` that wraps `IHubContext`; this keeps Infrastructure's consumers free of an Api project reference and lets unit tests fake out push delivery.
- Payloads are minimal — IDs and a few key fields. Clients use the payload as a signal to invalidate their TanStack Query cache and refetch authoritative data from the API.

### Backplane
- **Redis backplane wired** via `Microsoft.AspNetCore.SignalR.StackExchangeRedis`, configured in `Program.cs` against the same Redis instance used for the cache (channel prefix `myproperty.signalr` so SignalR pub/sub keys are isolated from cache entries).
- Toggleable via `SignalR:UseRedisBackplane` (default `true`). The integration suite flips this to `false` because Testcontainers does not run a Redis service — SignalR still resolves and `IHubContext<NotificationsHub>` is usable, deliveries just fan out via the in-process transport.
- Hub code is unchanged whether the backplane is on or off; all groups and group keys are the same.

### Frontend contract
- Frontend uses `@microsoft/signalr` to connect to `/hubs/notifications`.
- On receiving an event, the client calls `queryClient.invalidateQueries(['payments'])` (or the relevant key) to trigger a TanStack Query refetch.
- **TanStack Query remains the source of truth for data.** SignalR delivers signals; TanStack delivers data. Do not store SignalR payloads as canonical state in the frontend.

## File Storage

- **Interface:** `IFileStorage` in `Application/Common/Interfaces/`.
- Methods (M3.9 MVP): `UploadAsync(stream, fileName, contentType, ct) → fileKey`, `DownloadAsync(fileKey, ct) → stream`, `DeleteAsync(fileKey, ct)`.
- **`GetSignedUrlAsync` deliberately omitted** for the MVP. Local filesystem storage has no signed-URL equivalent, and no current consumer needs it. Re-added when a cloud implementation lands.
- Used for: receipt uploads (M3.9). Single consumer today; the `Files` table / two-step upload abstraction is post-M3 — see `docs/m3-backend-mvp.md` follow-ups.
- **Implementation:** `LocalFileStorage` in `Infrastructure/Storage/`. Stores files under `{LocalRoot}/receipts/{yyyy}/{MM}/{guid}{ext}`; the storage key is the relative path beneath `LocalRoot`. Path traversal is rejected at resolve time.
- **Configuration:** `FileStorage:LocalRoot` (relative or absolute path). Auto-created at startup. Dev default: `../../storage` (resolves to `<repo-root>/storage`, which is gitignored).
- **Validation:** 5 MB business cap (FluentValidation in `SubmitPaymentValidator` → 400 ValidationProblemDetails), 6 MB Kestrel cap via `[RequestSizeLimit]` on the action (→ 413). Allowed MIME types: `image/jpeg`, `image/png`, `application/pdf`. `Method == ReceiptUpload` requires a file; `Method == ManualRequest` forbids one.
- **Endpoint shape:** single-step multipart on `POST /api/v1/payments/{id}/submit`. Two-step (`POST /api/v1/files` returning a key) is a post-M3 change once a second consumer appears.
- **Download:** `GET /api/v1/payments/{id}/receipt` streams the file with `Content-Disposition: inline`. Authorization is lease-scoped: tenant on the payment's lease OR landlord that owns it.

## AI Integration

- **Receipt OCR (M3.10).** When a tenant uploads a receipt, a background job sends the image to Anthropic's vision API to extract amount, date, and merchant. Results pre-fill the payment submission form (tenant can correct) or are attached to the submission for landlord review.
- This replaces the omitted RAG/pgvector deliverable (BE-17). See M3 Decisions.
- AI client wrapper: `IReceiptOcrService` in `Application/Common/Interfaces/`, implemented in `Infrastructure/Ai/AnthropicReceiptOcrService.cs`. Do not call the SDK directly from handlers.
- API key from `Anthropic:ApiKey` config (env var in production, user secrets in dev).

## Invites

- **Token model.** Opaque random URL token (32 random bytes, URL-safe base64, ~43 chars). DB stores SHA256 hex (`TokenHash`, 64 chars, unique index). Plain token only ever lives in the invite email body, the Hangfire job arg, and the request URL — never in DB, never in logs.
- **Endpoints** (all under `/api/v1/invites`):
    - `POST /` — landlord-only. Creates invite, hashes token, persists, enqueues email via `IBackgroundJobQueue.EnqueueEmail`.
    - `GET /by-token/{token}` — anonymous preview. Returns 404 for null / non-Pending / expired.
    - `POST /{token}/accept` — authenticated. JWT email must match invite email — mismatch is 403 with `"This invite was sent to a different email address."`. Creates the `Lease` and marks invite `Accepted` in a single unit of work.
    - `POST /{token}/reject` — anonymous. Marks invite `Rejected`. Returns 204.
- **No 410 Gone.** Any invite that is not `Pending` or is past `ExpiresAt` returns 404 from preview/accept/reject. Frontend distinguishes UX from the 404 context.
- **Lease creation at acceptance**, not at invite creation. Multiple active leases per tenant are allowed (no constraint).
- **Unit-of-work owner.** `IInviteRepository.SaveChangesAsync` flushes the unit of work for accept. `ILeaseRepository.AddAsync` does not save. Both repos share the same scoped `AppDbContext`.
- **Email construction is inline in `CreateInviteHandler`.** No dedicated job class. Send is dispatched via existing `IBackgroundJobQueue.EnqueueEmail(EmailMessage)`.
- **Config:** `Invites:PortalBaseUrl`, `Invites:ExpiryDays` (default 7). Bound via `IOptions<InviteOptions>` with `ValidateDataAnnotations().ValidateOnStart()` — missing/malformed config crashes startup.

### Post-M3 follow-ups

- Keycloak admin client for fresh-tenant role assignment. Currently only seeded users (with Tenant role pre-assigned in `realm-export.json`) can accept invites end-to-end. Self-registered users get a JWT without the Tenant role and can't reach tenant endpoints after accepting.
- Mapperly retrofit. Handlers currently construct DTOs by hand. Single retrofit batch post-M3.
- Remove `ClaimsPrincipal? Principal` from `ICurrentUser`. Acknowledged abstraction leak — only exists because `IUserRepository.GetOrSyncFromClaimsAsync` takes a `ClaimsPrincipal`. Cleanup once role assignment moves server-side.
- FluentValidation validators on commands (M3.12).
- Invite audit fields (`AcceptedByUserId`, `ResultingLeaseId`, `RejectionReason`) — skipped this batch.
- RabbitMQ `InviteAccepted` / `InviteRejected` event publishing (M3.8).
- SignalR push to landlord on accept/reject (M3.6).
- **Per-IP rate limiting on anonymous invite endpoints** (`GET /by-token/{token}`, `POST /{token}/reject`). Without it, an attacker can enumerate token validity via the 404-vs-200/204 distinction. Owned by **M3.12** — limit per IP, not per user.
- `HashToken` duplication — identical private static in `CreateInviteHandler`, `AcceptInviteHandler`, `RejectInviteHandler`, `GetInviteByTokenHandler`, `InvitePreviewAndRejectTests` . Extract to `Application/Invites/InviteTokenHasher.cs` post-M3. Also delete MyProperty.Tests/Unit/Handlers/TestUtils/TokenHasher.cs and replace its usages with the extracted class.
- The hardcoded cache key string landlord:{landlordId}:dashboard in EvictDashboardCacheAsync — should reference a shared constant post-M3.

## Testing (M3.11)

- **xUnit** for the test framework. Project: `MyProperty.Tests/` (added at M3.11), split into `Unit/` and `Integration/`.
- **Moq** for hand-substitutions of repositories and `ICurrentUser`. Validators are instantiated directly — they're pure and cheap, no point mocking them.
- **Unit tests** cover validators, the four invite handlers + landlord-dashboard handler, the `KeycloakRolesTransformer`, the `HttpContextCurrentUser`, and the `CorrelationIdMiddleware`.
- **Integration tests** use `WebApplicationFactory<Program>` with **Testcontainers** spinning up real Postgres + Keycloak per test run (a single `ApiCollection` shares the fixture across classes — container start + Keycloak realm seed runs once). EF Core migrations are applied to the container at fixture init.
- **Auth is tested against live Keycloak**, not a stub. The fixture provisions a hermetic realm (`MyPropertyTest`), three realm roles, a public client with `directAccessGrants`, and four seed users (landlord×2, tenant×2). Tests mint real access tokens via the OAuth2 password grant; the API validates them via Keycloak's JWKS endpoint just like in production.
- **Two narrow substitutions** in the test factory:
    - `IDistributedCache` → `MemoryDistributedCache` (avoids depending on Redis; the cache code path through `RedisLandlordDashboardCache`/`ILandlordDashboardCache` is identical).
    - `IBackgroundJobQueue` → `RecordingBackgroundJobQueue` (captures `EmailMessage`s for assertions; prevents Hangfire from enqueueing real jobs that would hammer the unreachable test SMTP).
- **The test environment is `Development`** so `RequireHttpsMetadata=false` on the JWT bearer scheme — Testcontainers' Keycloak only exposes HTTP. The production gate in `Program.cs` deliberately permits HTTP only in Development.
- **Coverlet** wired via `coverlet.collector` for coverage runs (`dotnet test --collect:"XPlat Code Coverage"`). Target: meaningful coverage on handlers and validators; don't chase 100%.
- Full suite (101 tests: 79 unit + 22 integration) runs in ~30 s once Postgres + Keycloak images are cached locally.

## Logging & Observability

- **Serilog** as the logging provider, configured in `Program.cs` via `builder.Host.UseSerilog()`.
- Sinks: console (always) + Loki (via `Serilog.Sinks.Grafana.Loki`) when `LokiUrl` is configured.
- **Correlation IDs:** `Serilog.AspNetCore` + `RequestLoggingMiddleware`. Every request gets a correlation ID, propagated to background jobs via Hangfire job arguments.
- Log levels: `Information` for request/response, `Warning` for handled domain exceptions, `Error` for unhandled.
- **Loki + Grafana scope:** local Docker Compose only for the milestone (per M3 Decisions). Not deployed to production infrastructure for the demo window.

## Configuration

- `appsettings.json` (committed) — defaults and structure only, no secrets.
- `appsettings.Development.json` (committed) — dev URLs (localhost Keycloak, Postgres, etc.).
- **Secrets in dev:** .NET user secrets (`dotnet user-secrets`).
- **Secrets in prod:** environment variables.
- Strongly-typed options classes in `Api/Options/`, bound via `builder.Services.AddOptions<T>().Bind(...).ValidateDataAnnotations()`.

## Coding Rules

- **C# nullable reference types enabled** in every project. Treat warnings as errors.
- **No `dynamic`.** No reflection unless framework-required.
- **Async all the way.** Every I/O method is async, accepts `CancellationToken`, and passes it down. No `.Result`, no `.Wait()`, no `async void` outside event handlers.
- **No business logic in controllers.** Controllers translate HTTP ↔ commands/queries and nothing else.
- **No EF Core types in `Application` or `Domain`.** No `DbContext`, no `IQueryable<T>`, no `[Table]` attributes. Persistence concerns live in `Infrastructure`.
- **DTOs are records.** Entities are classes (mutable, EF-tracked).
- **One file per type.** Even small DTOs.
- **Constructor injection only.** No `[FromServices]`, no service locator.

## Infrastructure (Docker Compose)

`infrastructure/` at repo root contains `docker-compose.yml` for the local dev stack:
- PostgreSQL
- Keycloak (with realm import for `MyProperty` realm + Google IdP)
- Redis
- RabbitMQ (with management UI)
- File storage (provider TBD per File Storage section)
- Loki + Grafana

`docker compose up -d` from the repo root brings everything up. The API itself runs on the host via `dotnet run` for fast iteration; only dependencies are containerized in dev.

## Key Omissions (intentional)

- **RAG / pgvector (BE-17): not implemented.** Replaced with receipt OCR (M3.10). No domain use case for vector search at this stage.
- **MediatR: not adopted.** CQRS folder structure used without the library — see Architecture Patterns.
- **AutoMapper: not adopted.** Mapperly used instead.
- **MassTransit: not adopted.** Direct `RabbitMQ.Client` for event publishing.
- **Cloud file storage: not adopted.** Local filesystem only for M3 — see File Storage. Re-introduces `IFileStorage.GetSignedUrlAsync` when a cloud impl lands.
- **Two-step file upload: not adopted.** Single-step multipart on the submit endpoint for M3 — see File Storage. Splits into a dedicated upload endpoint when a second file consumer appears.

## Further Specs

- Portal features & flows: `docs/portals.md`
- Milestone deliverables: `docs/m3-backend-mvp.md`
- Frontend conventions: `frontend/CLAUDE.md`