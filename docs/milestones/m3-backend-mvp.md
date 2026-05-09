# Milestone 3 — Backend MVP

**Status:** 🟢 Active
**Window:** April 23 – Friday, May 8, 2026
**Aligns with:** Section 2 — Advanced Backend (Lectures 29–52)

## Inherited debt to resolve

Carried over from [M2](./m2-frontend-mvp.md#known-gaps-at-m2-close). Items here move to "Resolved" as they're closed out — do not edit M2's Known Gaps in place.

### Pre-M3 cleanup (target: complete by April 24)

Blocking items that must be fixed before M3 work begins, because building on top of them compounds the debt:

1. Consolidate ui/ folders — ✅ done (April 23). Merged into components/ui/, tenant imports migrated, app/(tenant)/_components/ui/ deleted.
2. Rewrite landlord dashboard + layout — ✅ done. LandlordLayout shell ✅ done via Batch L2 (April 24): DashboardShell, AccountBlock, Sidebar primitive, stub Properties/Tenants pages, 21 new tests. LandlordDashboard.tsx rewrite (Batch L3) ✅ done (April 29): Pagination primitive, formatDate util, Zod schemas, MSW fixture + handlers, TanStack Query hooks, tenant detail stub route, full dashboard rewrite.
3. Generalize lib/auth/keycloak.ts — ⏳ in progress (Batch K, April 27). Discriminated DecodedPayload union by portal, derived from realm_access.roles[]. Auth moved to shared useAuthStore (not per-portal). tenantAccountStatus moved out of JWT to /me endpoint. Per-portal KeycloakInit mints role-specific JWTs in dev (no ?devRole= query param — each portal hardcodes its role). Real Keycloak end-session wired with env vars, MSW intercepts in dev. Sign-out redirects to new top-level /logout page.
4. Fix useSubmitReceipt.ts multipart header bug — ✅ done (April 23).
5. Update docs/portals.md — ⏳ pending Batch K wrap-up.

Also done in this window (not on original list): Navbar hamburger hover bug fix (April 27, bundled with Batch K).

### M3-scope debt (resolved as part of M3 deliverables)

- Complete invite flow: 3 user cases + 4 invite statuses; migrate `schema.ts` and `useAcceptInvite.ts` from `_lib/` to `lib/types/` and `lib/hooks/`; replace `mockInvitePreview` with a real TanStack Query hook + Zod-validated response.
- Build landlord-side data layer (Zod schemas, store, endpoints, MSW handlers).
- Build payment confirmation flow end-to-end (endpoints + hooks + handlers + landlord UI).
- Add MSW payment-state selector + 4 fixture variants.

### Defer

- `useTenantAccount` dead-code decision — defer; harmless. Revisit when the hook is needed for read-only banner logic.
- `PaymentMethod` inferred type with no consumers — defer; trivial.

## Deliverables

| ID | Deliverable | Description |
|---|---|---|
| M3.1 | .NET 10 API running | Clean Architecture, Swagger docs, versioned endpoints, standardized error envelope |
| M3.2 | Authentication & authorization | Keycloak in Docker, JWT tokens, OAuth2 SSO, RBAC with 3+ roles, all endpoints protected |
| M3.3 | Database & ORM | PostgreSQL schema (ERD provided), EF Core with migrations, soft deletes, audit trails |
| M3.4 | SQL optimization proof | At least 3 queries analyzed with `EXPLAIN ANALYZE`, indexes added, before/after metrics |
| M3.5 | Redis caching | Cache-aside on at least one endpoint, performance comparison documented |
| M3.6 | Real-time feature (SignalR) | NotificationsHub at `/hubs/notifications`, JWT-authenticated, role-grouped connections, push events for payment + invite state changes |
| M3.7 | Background jobs | Hangfire for at least one job: email with retry logic + dead-letter queue |
| M3.8 | Message queue | RabbitMQ or Kafka integrated for at least one event-driven flow |
| M3.9 | File upload | Working file upload, validation, stored in cloud or local volume |
| M3.10 | AI integration | At least one AI-powered feature using OpenAI/Anthropic API |
| M3.11 | Backend tests | xUnit + WebApplicationFactory + Testcontainers, auth tested against live Keycloak |
| M3.12 | Input validation | FluentValidation on all endpoints, rate limiting on public endpoints |
| M3.13 | Structured logging | Serilog → Loki → Grafana pipeline, correlation IDs |
| M3.14 | .cursorrules for .NET | Backend-specific AI rules, AI-assisted Swagger enrichment demonstrated |
| M3.15 | AI Log Entry #3 | Document AI usage for API generation, query optimization, debugging, security |

## Technical Requirements

| ID | Requirement | Details |
|---|---|---|
| BE-1 | Clean Architecture | Controllers → Services → Repositories, DTOs with AutoMapper/Mapperly |
| BE-2 | API design | RESTful, versioned (URL or header), Swagger/OpenAPI documented, pagination |
| BE-3 | Authentication | Keycloak (Docker), JWT access + refresh tokens, OAuth2 (Google or GitHub SSO) |
| BE-4 | Authorization | RBAC with at least 3 roles, permission guards as middleware/policy-based |
| BE-5 | Database | PostgreSQL with EF Core, proper migrations workflow, soft deletes, audit trails |
| BE-6 | SQL optimization | Indexed queries, `EXPLAIN ANALYZE` used, N+1 problems eliminated |
| BE-7 | Redis caching | Cache-aside pattern on at least one high-traffic endpoint, measurable perf gain |
| BE-8 | Real-time | SignalR hub with JWT auth, role-based connection groups, server-push events tied to RabbitMQ consumers |
| BE-9 | Background jobs | Hangfire for at least one job (email, report generation, etc.) |
| BE-10 | Message streaming | RabbitMQ or Kafka for at least one event-driven feature |
| BE-11 | File handling | Upload (multipart or presigned URL), validation, cloud storage integration |
| BE-12 | Email service | Transactional email via MailKit, background job with retry + dead-letter queue |
| BE-13 | Testing | xUnit + WebApplicationFactory + Testcontainers, mocking with Moq, Coverlet |
| BE-14 | Input validation | FluentValidation on all endpoints |
| BE-15 | Rate limiting | Built-in .NET RateLimiter on public-facing endpoints |
| BE-16 | Structured logging | Serilog → Loki → Grafana, correlation IDs across requests |
| BE-17 | RAG endpoint | **Intentionally omitted** — see Decisions |
| BE-18 | AI API integration | OpenAI or Anthropic API for at least one product feature |

## Frontend work required to consume M3

Not in the official M3 deliverable list, but blocking — without these, the M3 backend has no client. Planned in parallel with backend work.

- Complete invite flow per Inherited debt
- Landlord Zod schemas: `property`, `invite`, `landlordDashboard`, `landlordTenant`, `landlordAccount`, `paymentAction`
- Shared useAuthStore (built in Batch K)
- Landlord store: uiSlice, notificationSlice, useLandlordStore (auth removed; lives in shared store)
- Landlord endpoints in `lib/api/endpoints.ts` — see `docs/api-contract.md` (to be written)
- Landlord MSW handlers + fixtures
- Payment confirmation hooks (`useConfirmPayment`, `useRejectPayment`) + MSW handlers that transition tenant-side payment state so the tenant's `useCurrentPayment` polling observes the change
- Landlord dashboard, tenants page, tenant detail page UI
- MSW payment-state selector (env var or `?mockState=` query param) + 4 fixture variants

## Frontend follow-ups discovered during pre-M3
Not blocking M3 backend, but tracked here so they don't get lost.

- Landing/login/signup separation. / is currently a combined landing + login + signup page that doesn't reflect the role-aware auth model. Should be refactored into separate role-aware login flows. Surfaced during Batch K.
- /logout is a placeholder. Currently a transitional page outside both portal route groups, used because redirecting to / after sign-out re-triggers KeycloakInit and silently re-signs the user in. Revisit when real Keycloak ships in M3.2 — Keycloak's end-session typically redirects to its own login page, which makes the placeholder obsolete.
- Sidebar mobile drawer has no visible close button. Carried from L1 known gaps. User closes via backdrop click or Escape. Worth a Sidebar follow-up batch eventually.
- Per-section error handling on LandlordDashboard. Currently shows a whole-page error if either the dashboard query or the upcoming-payments query fails. Should be replaced with per-section error states. Tracked as M3 frontend work.
- SignalR wiring for landlord queries. `useLandlordDashboard` and `useLandlordUpcomingPayments` need to call `queryClient.invalidateQueries` on `PaymentSubmitted`, `PaymentConfirmed`, `PaymentRejected` events from `NotificationsHub`. Blocked on M3.6 (SignalR hub). Tracked as M3 frontend work.
- **NEXT_PUBLIC_API_BASE_URL + MSW interaction**: when the base URL is set, axios builds absolute URLs that MSW's relative-path handlers don't match, so requests escape to the real network. For dev and E2E we leave the var unset so MSW can intercept. Production wiring (Next.js rewrites vs direct absolute calls) is a follow-up — TBD per CLAUDE.md.
- **Payment rejection model — migrate from Model 1 (loop) to Model 2 (terminal + supersession).**
  Today, rejecting a Pending payment sets the row to `Rejected` and persists
  `RejectionReason`/`RejectedAt`; the tenant's next `Submit` call transitions
  the same row back to `Pending` (the `Submit` state guard accepts both
  `Outstanding` and `Rejected`) and clears the rejection metadata. The
  long-term model is to make `Rejected` terminal and create a new
  `Outstanding` row linked via a supersession FK (`SupersededByPaymentId` or
  a `PaymentSeries` grouping ID). This gives a clean per-attempt audit trail
  but requires: schema migration (new FK column + backfill, trivial in dev),
  query rewrites everywhere "current payment for lease X period Y" is asked
  (the dominant case is `useCurrentPayment` on the tenant frontend),
  `RejectPaymentHandler` change to insert-and-link instead of mutate-in-place,
  and a `PaymentHistory` display decision (collapse to current-per-period or
  show every attempt). Estimated 1–2 focused days when prioritized.
  Tracked here so it isn't lost — the trade-offs are documented in the
  P1 planning conversation.

## Decisions

- **SignalR re-introduced (M3.6 / BE-8)** — instructor feedback (April 27 email) explicitly required a real-time feature. Original M2 polling-only decision is reversed. Scope: `NotificationsHub` pushing payment state changes (`PaymentSubmitted`, `PaymentConfirmed`, `PaymentRejected`, `LeaseExpiringSoon`) to tenants, and invite/payment events (`PaymentSubmitted`, `InviteAccepted`, `InviteRejected`) to landlords. Connections are JWT-authenticated and grouped by user ID server-side. SignalR delivers signals only; TanStack Query remains the source of truth for data — clients invalidate queries on signal receipt and refetch from the API. **No Redis backplane** — single API instance for the milestone, scaling to multi-instance is a config change. Pushes are triggered from RabbitMQ consumers, not from API request handlers, keeping the request path fast.
- **RAG / pgvector omitted (BE-17)** — no domain use case at this stage. "Smart search over leases" is a stretch for a property management tool with a small fixed schema. Replaced with **receipt OCR** (M3.10): when a tenant uploads a receipt, run it through a vision model to extract amount/date/merchant and pre-fill or validate the submission. Real product feature, not a demo. Confirmed acceptable per instructor feedback (an AI feature is required; OCR satisfies that).
- **RabbitMQ event set (M3.8)** — five events end-to-end: `PaymentSubmitted`, `PaymentConfirmed`, `PaymentRejected`, `InviteAccepted`, `InviteRejected`. Each consumed by a hosted service that translates the event into side effects (Hangfire job for retryable async work, SignalR push for real-time client notification). The queue genuinely earns its place as the integration point between command handlers, retryable jobs, and real-time notifications. Library: `RabbitMQ.Client` directly; no MassTransit.
- **Loki + Grafana scoped to local Docker Compose (M3.13)** — Serilog is real and used everywhere, but the Loki/Grafana pipeline runs locally in Docker Compose for the demo rather than being deployed. Production-grade log aggregation is out of scope for the milestone window.
- **Roles for RBAC (M3.2 / BE-4)** — three roles: `Tenant`, `Landlord`, `Admin`. Admin is the lightest-touch role and gates one or two debug/admin endpoints to satisfy the "3+ roles" requirement without bloating scope.
- **M3.2 audience validation deferred** — JWT bearer config currently sets
  `ValidateAudience = false`. Real fix requires an audience mapper on a
  `myproperty-api` Keycloak client (realm-export.json) plus matching
  `ValidAudience` in `Program.cs`. Tracked as M3.2 follow-up; target close
  before May 6 demo. Loudly TODO'd in Program.cs so it cannot ship silently.

## Progress Log

### April 22, 2026

#### Completed
- M2 → M3 audit (saved as `docs/audits/m2-m3-audit-part{1,2}-*.md`)
- Closed M2 with documented Known Gaps
- Split milestones documentation per-file; created this M3 record
- Decisions above ratified (SignalR cut, RAG → OCR, RabbitMQ thin, Loki local, 3 roles defined)

#### Up Next
- Pre-M3 cleanup items 1–5 (target April 24)
- Begin M3.1 (.NET API scaffold) and M3.3 (Postgres + EF Core) on April 27

### April 27, 2026

#### Completed
- Backend `CLAUDE.md` written (`backend/CLAUDE.md`)
- Solution layout decided: 4 projects under `backend/` (`MyProperty.Api`, `MyProperty.Application`, `MyProperty.Domain`, `MyProperty.Infrastructure`), tests added at M3.11
- Architecture decisions ratified: Clean Architecture (4 projects), CQRS folder structure without MediatR, thin per-aggregate repositories, Mapperly for mapping, RFC 7807 Problem Details, `BaseEntity` with EF interceptor for audit + soft delete, URL-based versioning, Google SSO via Keycloak

#### Scope changes (instructor feedback, April 27)
- **SignalR re-introduced** — instructor email explicitly required a real-time feature. M3.6 / BE-8 flipped from cut to active. Scope: `NotificationsHub` with payment + invite events. Decision rewritten above.
- **AI feature confirmed mandatory** — receipt OCR (M3.10) satisfies this. No change to plan.
- **`.claude/` directory visibility** — instructor wants to review Claude Code configs and any custom skills. Ensure `.claude/` is checked into the repo (not gitignored) before submission.

## Frontend pre-M3 work (April 23–27)

- April 23: ui/ folder consolidation, useSubmitReceipt.ts multipart fix
- April 23–24: Batch L1 (Sidebar primitive, useMediaQuery)
- April 24: Batch L2 (LandlordLayout shell — DashboardShell, AccountBlock, stub Properties/Tenants pages, 21 new tests)
- April 27: Batch K (keycloak.ts generalization, shared useAuthStore, useAuth() hook, /me endpoint for tenantAccountStatus, MockProvider/KeycloakInit wrapping for landlord layout, real sign-out wiring, /logout page, doc updates) + Navbar hover fix bundled in

Note: Cleanup batches were not enumerated in the original April 22 plan. Surfaced as the work decomposed.

#### Up Next
- Batch K + Navbar (in progress, target close: April 27)
- Batch L3 — LandlordDashboard.tsx rewrite (target: April 28)
- Backend scaffolding starts April 28 after L3 closes. Tight window: M3 runs through May 8 — losing 5 days to cleanup leaves 11 days for the full backend MVP (15 deliverables including Keycloak in Docker, RabbitMQ, SignalR, Postgres + migrations, Hangfire, OCR, Testcontainers tests, Loki/Grafana, AI Log #3).
- File storage decision (offline + online split) — pending instructor confirmation
- Begin M3.1 (.NET API scaffold), M3.3 (Postgres + EF Core), and M3.11 setup (Testcontainers + Keycloak — start early)

### May 4, 2026

#### Completed (M3.4 — SQL optimization proof)
- Three workload queries timed with `EXPLAIN (ANALYZE, BUFFERS)` against a
  200k-payment seeded dataset; warm-cache results:
  - **Q1** Landlord upcoming-payments dashboard: 16.363 → 0.739 ms (~22×)
    via existing `IX_payments_LeaseId_Status` + `IX_properties_LandlordId`
  - **Q2** Mark-overdue-payments Hangfire job: 4.616 → 0.045 ms (~103×) via
    a new partial index `IX_payments_DueDate_Outstanding`. The original
    full-column `IX_payments_DueDate` was *worse* than no index for this
    workload (8.981 ms) because `DueDate < today` matches ~74% of rows.
  - **Q3** Invite-by-token: 0.492 → 0.038 ms (~13×) via existing unique
    `IX_invites_Token`
- Seed + benchmark scripts committed under
  `docs/performance/m3-sql-optimization/` with raw `results.txt` for audit.
- Migration `20260504095019_AddOverduePaymentsPartialIndex` ships the partial
  index. `PaymentConfiguration.cs` updated with the filter +
  `HasDatabaseName` so the partial scope is self-documenting.

### May 5, 2026

#### Completed (M3.5 — Redis cache-aside, code complete)
- Redis 7-alpine added to `docker-compose.yml` (no persistence — `--save ""`,
  AOF off — it's a cache, not a store).
- `Microsoft.Extensions.Caching.StackExchangeRedis 10.0.0` added to
  `MyProperty.Infrastructure`. `IDistributedCache` registered via
  `AddStackExchangeRedisCache`; instance prefix `myproperty:dev:` separates
  dev keys from any future shared Redis.
- New endpoint `GET /api/v1/landlord/dashboard` aggregates 5 counters
  (properties, active leases, active tenants, pending payments, overdue
  payments). Cache-aside via `ILandlordDashboardCache` (Application interface,
  `RedisLandlordDashboardCache` implementation in Infrastructure). TTL 60 s,
  key `landlord:{landlordId}:dashboard`.
- `AcceptInviteHandler` now invalidates the dashboard cache after a lease is
  created — the only existing landlord-relevant write. Future payment
  handlers (M3.8) plug into the same interface.
- Cache faults (Redis unreachable, serialization error) are swallowed and
  logged at `Warning`. Endpoint degrades to DB-backed query — never fails
  closed on a cache outage.
- Standalone bench harness committed at
  `docs/performance/m3-redis-caching/bench/` — slim DI graph, runs the
  handler directly, reports min/median/p95/max for miss vs hit. Builds
  green; numbers pending an actual run against the M3.4 bench dataset.
- Settings: new `Cache` section in `appsettings.json` and
  `appsettings.Development.json` with `RedisConnection`, `InstancePrefix`
  and `LandlordDashboardTtlSeconds`. Validated on startup via
  `ValidateDataAnnotations().ValidateOnStart()`.

#### Up Next
- Run the bench against a live stack and replace the placeholder numbers
  in `docs/performance/m3-redis-caching/README.md`.
- M3.6 (SignalR) — unblocks frontend SignalR wiring already on the M3
  follow-up list.

### April 29, 2026

#### Completed
- Batch L3: LandlordDashboard rewrite + landlord data layer
  - `components/ui/Pagination.tsx` — new shared primitive, ellipsis truncation, single render path across viewports
  - `lib/utils/formatDate.ts` — ISO date → "Apr 20, 2026" via Intl
  - `lib/types/landlord/dashboard.ts` — Zod schemas for all landlord dashboard shapes
  - `mocks/fixtures/landlordDashboard.ts` — fixture data + `buildUpcomingPaymentsResponse` helper, schema-validated at module load
  - `lib/api/endpoints.ts` — landlordDashboard, landlordUpcomingPayments endpoints
  - `lib/hooks/queryKeys.ts` — landlord namespace
  - `mocks/handlers.ts` — MSW handlers for both landlord endpoints
  - `lib/hooks/useLandlordDashboard.ts` + `useLandlordUpcomingPayments.ts` — TanStack Query hooks
  - `app/dashboard/tenants/[id]/page.tsx` — tenant detail stub route
  - `app/dashboard/LandlordDashboard.tsx` — full rewrite using DataTable, Badge, Card, Pagination primitives + real hooks
  - Pre-M3 cleanup complete. Backend scaffolding starts April 29.

### May 2, 2026

#### Completed (M3.2 continuation, taking over from teammate)
- JWT hardening:
  - Cleared legacy inbound claim type map (`JsonWebTokenHandler.DefaultInboundClaimTypeMap.Clear()`)
  - Documented and hardened `KeycloakRolesTransformer` (idempotency guard, XML docs explaining why a transformer is needed at all)
  - Default-deny authorization via `FallbackPolicy = RequireAuthenticatedUser`
  - `HealthController` explicitly `[AllowAnonymous]`, sealed, `HealthResponse` extracted to `Application/Health/`
- `ICurrentUser` abstraction: interface in `Application/Common/Interfaces/`, `HttpContextCurrentUser` impl in `Api/Auth/`, registered scoped
- `MeController`: `GET /api/v1/me` (any authenticated user), `GET /api/v1/me/tenant-only` (RequireTenant policy)
- Google IdP added to Keycloak realm with env-var-substituted credentials; real Google OAuth credentials provisioned and verified end-to-end
- `defaultClientScopes` explicitly assigned to `myproperty-frontend` client (defensive against Keycloak default changes)
- Repo-root `.env.example` created for compose-level secrets (Google OAuth)
- Frontend dev-bypass: implicit (missing `NEXT_PUBLIC_KEYCLOAK_URL`) → explicit `NEXT_PUBLIC_DEV_AUTH_BYPASS=true`
- Symmetric bypass added to landlord-portal `KeycloakInit` (was previously missing — landlord portal broke without Keycloak URL set)

#### Known gaps (carried forward)
- **Audience validation disabled** — JWT bearer config has `ValidateAudience = false`. Loud TODO in `Program.cs`. Requires audience mapper on a Keycloak `myproperty-api` client. Target close: before May 6 demo.
- **Per-portal `KeycloakInit` duplication**: bypass logic now identical across `(tenant)` and `dashboard` versions. Worth extracting to a shared `useKeycloakInit({ portal })` hook in a future batch.
- ~~Testcontainers integration test for Keycloak → JWT → policy flow deferred to M3.11.~~ **Closed by M3.11** — see `AuthorizationTests.cs`: anonymous → 401, garbage bearer → 401, tenant token → 200 with role claim, tenant on `/me/tenant-only` → 200, landlord on same → 403, landlord on `/landlord/dashboard` → 200, tenant on same → 403.
- **`HashToken` duplication in invite handlers** — `CreateInviteHandler`, `AcceptInviteHandler`, `RejectInviteHandler`, and `GetInviteByTokenHandler` each carry an identical private static `HashToken` method (SHA256 hex, lowercase). Extract to `Application/Invites/InviteTokenHasher.cs` (internal static class) in a post-M3 cleanup pass.

#### M3.2 deliverable status
- M3.2 / BE-3 (Keycloak + OAuth2 SSO): ✅
- M3.2 / BE-4 (RBAC, 3 roles, policy guards): ✅

### May 4, 2026

#### Completed (M3.1 invite flow MVP — Batch I)
- 4 endpoints live: `POST /api/v1/invites` (landlord), `GET /api/v1/invites/by-token/{token}` (anon), `POST /api/v1/invites/{token}/accept` (auth), `POST /api/v1/invites/{token}/reject` (anon).
- Token model: plain token (32-byte URL-safe base64) → SHA256 hex `TokenHash` in DB. Plain token only in email body + Hangfire arg.
- Repositories established: `IInviteRepository` (UoW owner for accept), `ILeaseRepository` (`AddAsync` only), `IPropertyRepository` (`GetByIdAsync` with `.Include(Landlord)`).
- CQRS folder pattern established for the codebase: `Application/Invites/Commands/{Name}/{Command,Handler}.cs` and `Application/Invites/Queries/{Name}/{Query,Handler,Dto}.cs`.
- Lease created at acceptance, not at invite creation. Email match enforced on accept (403 on mismatch). Non-Pending/expired invites → 404 (no 410 Gone).
- `InviteOptions` bound with `ValidateDataAnnotations().ValidateOnStart()`.
- Migration `RenameInviteTokenToTokenHash` applied (Drop+Add semantics; dev `invites` truncated before apply). Also added `LandlordId` to `Lease` (Option B — denormalized for dashboard queries).
- `ClaimsPrincipal? Principal` added to `ICurrentUser` as an acknowledged abstraction leak — TODO'd for post-M3 cleanup.
- `basic` client scope added to `myproperty-frontend` in Keycloak (was missing, causing `sub` claim to be absent from JWTs). Realm re-exported.
- `Microsoft.Extensions.Logging.Abstractions` and `Microsoft.Extensions.Options` (both `10.0.0`) added to `MyProperty.Application.csproj`.

#### Cut from this batch (post-M3 follow-ups)
- Keycloak admin client for fresh-tenant role assignment — demo with seeded `tenant@dev.local`.
- Mapperly — manual DTO construction in handlers; retrofit batch post-M3.
- `ClaimsPrincipal` on `ICurrentUser` — cleanup post-M3.
- FluentValidation validators (M3.12).
- Invite audit fields (`RejectionReason`, `AcceptedByUserId`, `ResultingLeaseId`).
- RabbitMQ `InviteAccepted` / `InviteRejected` events (M3.8).
- SignalR push on accept/reject (M3.6).
- Per-IP rate limiting on anonymous invite endpoints (token enumeration mitigation) — owned by M3.12.
- `HashToken` extraction to `InviteTokenHasher` — duplicated across 4 handlers; post-M3 cleanup pass.

#### Up Next
- M3.5 (Redis dashboard cache) or M3.6 (SignalR hub). M3.6 unblocks frontend SignalR wiring already tracked under follow-ups.

### May 6, 2026

#### Completed (M3.12 — Input validation + rate limiting)
- FluentValidation 11.11.0 added to `MyProperty.Application`,
  `FluentValidation.DependencyInjectionExtensions` 11.11.0 to
  `MyProperty.Api`. Auto-registered in DI via
  `AddValidatorsFromAssemblyContaining<CreateInviteCommand>()`.
- One validator per command/query, co-located with each
  command/query/handler: `CreateInviteValidator`, `AcceptInviteValidator`,
  `RejectInviteValidator`, `GetInviteByTokenValidator`,
  `GetLandlordDashboardValidator`.
- `Application/Common/Validation/ValidatorExtensions.EnsureValidAsync`
  runs the validator and rethrows failures as the existing
  `Application.Common.Exceptions.ValidationException` so the existing
  `GlobalExceptionHandler` maps to RFC 7807 `ValidationProblemDetails` (400)
  with no plumbing changes. Each handler calls it on the first line.
- Rate limiting via `Microsoft.AspNetCore.RateLimiting` (built-in .NET).
  Two named policies on fixed-window partitions:
  - `anon-invite` — per-IP, 30 req/min. Applied to
    `GET /api/v1/invites/by-token/{token}` and
    `POST /api/v1/invites/{token}/reject`. Mitigates the token-enumeration
    oracle (404-vs-200 / 404-vs-204) flagged in the post-M3 follow-up list.
  - `authenticated` — per-user (`sub` claim), 120 req/min, with IP
    fallback when the claim is missing. Applied to `LandlordController`,
    `MeController`, `POST /api/v1/invites`, `POST /api/v1/invites/{token}/accept`.
  - 429 on rejection. `app.UseRateLimiter()` placed after authn/authz so
    the `sub` claim is available for partitioning.
- `[ProducesResponseType]` attributes updated to advertise 400 and 429.

#### Completed (M3.1 continuation — Payments handlers, Batches P1 + P2)
- Full payment state machine implemented end-to-end:
  `Outstanding → Pending → Confirmed (terminal)`, with `Pending → Rejected`
  and the tenant's next `Submit` call accepting either `Outstanding` or
  `Rejected` to transition back to `Pending`. `RejectionReason`/`RejectedAt`
  are persisted on rejection and cleared on the next submit, so the tenant
  UI shows "your last submission was rejected because X" while
  `status == 'Rejected'` and the banner disappears the moment the row
  transitions back to `Pending`.
- Four handlers shipped: `CreatePaymentHandler` (landlord, Outstanding seed),
  `SubmitPaymentHandler` (tenant, Outstanding → Pending),
  `ConfirmPaymentHandler` (landlord, Pending → Confirmed),
  `RejectPaymentHandler` (landlord, Pending → Rejected, required reason min 10 / max 500 chars, trimmed).
- `IPaymentRepository` (`GetByIdWithLeaseAsync`, `AddAsync`, `SaveChangesAsync`) +
  `ILeaseRepository.GetByIdAsync` extension. Repository style matches existing
  per-aggregate convention (no generic base, methods named for use cases).
- Resource-scoped authorization on every handler: tenant ownership check on
  Submit, landlord ownership check on Create / Confirm / Reject. Pattern is
  inline `KeycloakSubId → IUserRepository.GetByKeycloakSubIdAsync` lookup +
  `Lease.LandlordId` / `Lease.TenantId` comparison. TODO post-M3: extract to
  `ICurrentUserContext` to remove the per-handler duplication.
- 4 FluentValidation validators co-located with each command, registered via
  the existing assembly scan in `Application` (no new DI plumbing needed).
- 4 event record types defined (`PaymentCreatedEvent`, `PaymentSubmittedEvent`,
  `PaymentConfirmedEvent`, `PaymentRejectedEvent`) under
  `Application/Payments/Events/`. **Not yet published** — handlers carry
  `// TODO M3.8` blocks at the publish point with the exact event payload to
  emit. Each handler also keeps the events `using` directive live via a
  `_ = typeof(EventName)` line so M3.8 is a delete-and-replace rather than a
  fix-the-imports exercise.
- `PaymentsController` (`backend/MyProperty.Api/Controllers/V1/PaymentsController.cs`)
  wires four endpoints under `/api/v1/payments`:
  `POST /` (landlord, Create), `POST /{id}/submit` (tenant),
  `POST /{id}/confirm` (landlord), `POST /{id}/reject` (landlord).
  Per-action `[Authorize(Policy = "RequireLandlord" | "RequireTenant")]` and
  `[EnableRateLimiting("authenticated")]`.
- `ILandlordDashboardCache.InvalidateAsync(landlordId, ct)` called from all
  four handlers after `SaveChangesAsync`. Mirrors the pattern set by
  `AcceptInviteHandler`. Every payment write shifts the M3.5 dashboard's
  pending/overdue counters, so the cached `landlord:{id}:dashboard` aggregate
  must be dropped on each transition.

#### Cut from this batch (deferred)
- File upload for receipt submissions — owned by **M3.9**. `SubmitPaymentHandler`
  carries an explicit `// TODO M3.9` block listing the exact validation, storage
  call, and error-handling work required. Tenant frontend can build the file
  picker UX against the eventual shape; submit endpoint is JSON-only until M3.9
  (also called out in `docs/portals.md`).
- Event publishing — owned by **M3.8**. Event records are defined; publisher
  wiring is mechanical when M3.8 lands.
- SignalR push to tenant/landlord on state transitions — owned by **M3.6**.
  Triggered by M3.8 RabbitMQ consumers, not by handlers directly.
- OCR consumer for `PaymentSubmittedEvent` — owned by **M3.10**.
- Tests (handler unit tests, controller integration tests) — owned by **M3.11**.
- Recurring rent generation (Hangfire job that creates Outstanding payment
  rows on a schedule) — post-M3 follow-up. M3 ships with manual `CreatePayment`
  for testing.
- `ICurrentUserContext` helper to factor out the per-handler
  `KeycloakSubId → User` lookup — post-M3 cleanup pass.

### May 8, 2026

#### Completed (M3.9 — File upload, MVP)
- `IFileStorage` interface added in `Application/Common/Interfaces/`
  (`UploadAsync` / `DownloadAsync` / `DeleteAsync`). `GetSignedUrlAsync`
  intentionally cut for the MVP; documented in `backend/CLAUDE.md` Key
  Omissions, re-added when cloud storage lands.
- `LocalFileStorage` implementation in `Infrastructure/Storage/`. Files at
  `{LocalRoot}/receipts/{yyyy}/{MM}/{guid}{ext}`. Path-traversal hardened.
  Storage root auto-created on startup. Dev `LocalRoot` is `../../storage`,
  resolving to `<repo-root>/storage` (already gitignored).
- `Payment` entity gained `ReceiptContentType` and `ReceiptSizeBytes`
  (both nullable). Migration `AddReceiptContentTypeAndSize` adds two
  nullable columns; no data backfill required.
- `SubmitPaymentCommand` extended with `FileStream`, `FileName`,
  `ContentType`, `FileSizeBytes`. `SubmitPaymentValidator` enforces:
  size ≤ 5 MB, MIME ∈ {`image/jpeg`, `image/png`, `application/pdf`},
  `ReceiptUpload` requires all four file fields, `ManualRequest` forbids
  any of them — both rule sets surface as 400 `ValidationProblemDetails`.
- `PaymentsController.Submit` switched from `application/json` to
  `multipart/form-data` via `[FromForm]` + `IFormFile?`. Outer hard cap is
  `[RequestSizeLimit(6 MB)]` so Kestrel returns 413 before any of our
  code runs; the 5 MB business limit is enforced by the validator and
  produces 400 with the standard envelope.
- `SubmitPaymentHandler` now streams uploads through `IFileStorage` and
  persists the four receipt fields. The publisher already routes
  `PaymentSubmittedEvent` via `IntegrationEventNaming` →
  `payment.submitted`; the event payload gained `ReceiptFileKey` so the
  M3.10 OCR consumer can fetch the file without a DB round-trip
  (consumer skips events whose key is null).
- `GET /api/v1/payments/{id}/receipt` added. Lease-scoped authorization
  (tenant on the lease or landlord that owns it; anyone else 403).
  Streams inline via `Content-Disposition: inline; filename="..."`.
  Returns 404 for missing payment OR missing receipt
  (`Method == ManualRequest` submissions).
- `FileStorage` config section added to `appsettings.json` and
  `appsettings.Development.json`. `IOptions<FileStorageOptions>` bound
  with `ValidateDataAnnotations().ValidateOnStart()`.
- `backend/CLAUDE.md` File Storage section + Key Omissions section
  rewritten to match what shipped.

#### Cut from this batch (deferred)
- Tests — M3.11 already done at 101 tests; no additional coverage in
  this batch. Receipt upload + download path is covered manually only.
- OCR (M3.10) — event payload now carries `ReceiptFileKey` so the
  consumer is a drop-in once M3.10 lands.
- SignalR push on `PaymentSubmitted` (M3.6) — owned by M3.6.
- Two-step file upload (`POST /api/v1/files`) — single-step multipart
  ships now; split when a second file consumer appears post-M3.
- Cloud storage impl — local filesystem only for the milestone.
- `GetSignedUrlAsync` on `IFileStorage` — re-added with cloud impl.
- `ICurrentUserContext` extraction (the `KeycloakSubId → User` lookup
  is now duplicated across five payment-related handlers including
  `DownloadReceiptHandler`) — post-M3 cleanup pass.

#### M3.9 deliverable status
- M3.9 / BE-11: ✅ done.

#### Post-M3 follow-ups
- **OCR result storage — extract to `PaymentReceiptOcr` table.** OCR
  results currently live as five nullable columns on `Payment`
  (`OcrAmount`, `OcrDate`, `OcrMerchant`, `OcrProcessedAt`,
  `OcrRawResponse`). Pragmatic for the M3.10 deadline, but `Payment`
  already carries 14 properties and `OcrRawResponse` is unbounded text
  on a query-hot entity. Migrate to a dedicated `PaymentReceiptOcr`
  table with FK to `Payment` (unique today; drop uniqueness if multiple
  OCR attempts per payment are ever wanted). One-batch refactor: new
  table, copy data, drop columns, update `ReceiptOcrJob` write path.
  No external consumers today, so the cutover is internal-only.

## Deliverable Status

| ID | Status | Notes |
|---|----|---|
| M3.1 | ✅ done | Invite flow MVP — Batch I (May 4, 2026). Payments state machine — Batches P1 + P2 (May 6, 2026): Create / Submit / Confirm / Reject handlers, controller, validators, event record types, dashboard cache invalidation. M3.8 event publishing, M3.9 file upload, M3.6 SignalR push, M3.11 tests deferred to their own deliverables. |
| M3.2 | ✅ done | Keycloak + JWT + RBAC. Audience validation still TODO. |
| M3.3 | ✅ done | PostgreSQL + EF Core + migrations. |
| M3.4 | ✅ done | 3 queries with `EXPLAIN (ANALYZE, BUFFERS)`, ~22× / ~103× / ~13× speedups; partial index for overdue scan replaces a counter-productive full-column index. See `docs/performance/m3-sql-optimization/`. |
| M3.5 | ✅ done | Redis cache-aside on `GET /api/v1/landlord/dashboard` (60 s TTL, key `landlord:{id}:dashboard`). Bench harness committed under `docs/performance/m3-redis-caching/bench/`; |
| M3.6 | ⏳ open | Scope: NotificationsHub, payment + invite events, no Redis backplane |
| M3.7 | ✅ done | Hangfire email job + retry + DLQ. |
| M3.8 | ✅ done | Completed PaymentConfirmed Event flow. Others are for post M#
| M3.9 | ✅ done | Local filesystem `IFileStorage` (`LocalFileStorage`), 5 MB / MIME-allowlist validation, multipart submit endpoint, lease-scoped download endpoint, event payload carries `ReceiptFileKey` for M3.10. Cloud storage + signed URLs deferred post-M3. |
| M3.10 | ⏳ open | Scope: receipt OCR (replaces RAG) |
| M3.11 | ✅ done | xUnit test project under `backend/MyProperty.Tests/`. **79 unit tests** (validators, handlers with Moq, Keycloak roles transformer, correlation-ID middleware) + **22 integration tests** running against live Postgres + Keycloak via Testcontainers. Auth tested end-to-end: real password-grant tokens minted by the Keycloak container, validated by the API's JWT bearer middleware against the realm's JWKS. Substitutes `IDistributedCache` (in-memory) and `IBackgroundJobQueue` (recording fake) so tests don't depend on Redis or trigger Hangfire/SMTP retries. Full suite runs in ~30 s after image pull. |
| M3.12 | ✅ done | FluentValidation on every command/query (5 validators, handler-side `EnsureValidAsync` rethrows as the app's `ValidationException` → existing global handler maps to RFC 7807 `ValidationProblemDetails`). `Microsoft.AspNetCore.RateLimiting` with two policies: `anon-invite` (per-IP, 30/min) on the anonymous invite endpoints to deter token enumeration, `authenticated` (per-user, 120/min) on JWT-protected endpoints. |
| M3.13 | ✅ done | Scope: local Docker Compose |
| M3.14 | Not needed | |
| M3.15 | ⏳ open | |