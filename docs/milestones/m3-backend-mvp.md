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

## Decisions

- **SignalR re-introduced (M3.6 / BE-8)** — instructor feedback (April 27 email) explicitly required a real-time feature. Original M2 polling-only decision is reversed. Scope: `NotificationsHub` pushing payment state changes (`PaymentSubmitted`, `PaymentConfirmed`, `PaymentRejected`, `LeaseExpiringSoon`) to tenants, and invite/payment events (`PaymentSubmitted`, `InviteAccepted`, `InviteRejected`) to landlords. Connections are JWT-authenticated and grouped by user ID server-side. SignalR delivers signals only; TanStack Query remains the source of truth for data — clients invalidate queries on signal receipt and refetch from the API. **No Redis backplane** — single API instance for the milestone, scaling to multi-instance is a config change. Pushes are triggered from RabbitMQ consumers, not from API request handlers, keeping the request path fast.
- **RAG / pgvector omitted (BE-17)** — no domain use case at this stage. "Smart search over leases" is a stretch for a property management tool with a small fixed schema. Replaced with **receipt OCR** (M3.10): when a tenant uploads a receipt, run it through a vision model to extract amount/date/merchant and pre-fill or validate the submission. Real product feature, not a demo. Confirmed acceptable per instructor feedback (an AI feature is required; OCR satisfies that).
- **RabbitMQ event set (M3.8)** — five events end-to-end: `PaymentSubmitted`, `PaymentConfirmed`, `PaymentRejected`, `InviteAccepted`, `InviteRejected`. Each consumed by a hosted service that translates the event into side effects (Hangfire job for retryable async work, SignalR push for real-time client notification). The queue genuinely earns its place as the integration point between command handlers, retryable jobs, and real-time notifications. Library: `RabbitMQ.Client` directly; no MassTransit.
- **Loki + Grafana scoped to local Docker Compose (M3.13)** — Serilog is real and used everywhere, but the Loki/Grafana pipeline runs locally in Docker Compose for the demo rather than being deployed. Production-grade log aggregation is out of scope for the milestone window.
- **Roles for RBAC (M3.2 / BE-4)** — three roles: `Tenant`, `Landlord`, `Admin`. Admin is the lightest-touch role and gates one or two debug/admin endpoints to satisfy the "3+ roles" requirement without bloating scope.

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

## Deliverable Status

| ID | Status | Notes |
|---|---|---|
| M3.1 | ⏳ open | |
| M3.2 | ⏳ open | |
| M3.3 | ⏳ open | |
| M3.4 | ⏳ open | |
| M3.5 | ⏳ open | |
| M3.6 | ⏳ open | Scope: NotificationsHub, payment + invite events, no Redis backplane |
| M3.7 | ⏳ open | |
| M3.8 | ⏳ open | Scope: 5 events (`PaymentSubmitted`, `PaymentConfirmed`, `PaymentRejected`, `InviteAccepted`, `InviteRejected`) |
| M3.9 | ⏳ open | |
| M3.10 | ⏳ open | Scope: receipt OCR (replaces RAG) |
| M3.11 | ⏳ open | Start early — Testcontainers + Keycloak is the hard part |
| M3.12 | ⏳ open | |
| M3.13 | ⏳ open | Scope: local Docker Compose |
| M3.14 | ⏳ open | |
| M3.15 | ⏳ open | |