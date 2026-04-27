# Milestone 3 — Backend MVP

**Status:** 🟢 Active
**Window:** April 23 – Friday, May 8, 2026
**Aligns with:** Section 2 — Advanced Backend (Lectures 29–52)

## Inherited debt to resolve

Carried over from [M2](./m2-frontend-mvp.md#known-gaps-at-m2-close). Items here move to "Resolved" as they're closed out — do not edit M2's Known Gaps in place.

### Pre-M3 cleanup (target: complete by April 24)

Blocking items that must be fixed before M3 work begins, because building on top of them compounds the debt:

1. **Consolidate `ui/` folders** — merge into `components/ui/` (root), migrate tenant imports, delete `app/(tenant)/_components/ui/`. Per-component decision on which version is canonical (audit found tenant versions are feature-richer, root versions are token-compliant).
2. **Rewrite landlord dashboard + layout** — `app/dashboard/LandlordDashboard.tsx` and `LandlordLayout.tsx` from scratch in Tailwind + design tokens. No inline styles, no hex constants, `dark:` variants, `md:`/`lg:` breakpoints. Use the compliant tenant portal as the model.
3. **Generalize `lib/auth/keycloak.ts`** — discriminated union for `DecodedPayload` (tenant / landlord / admin), role-aware `setAuth` routing, per-role dev JWTs. Required before any landlord auth work.
4. **Fix `useSubmitReceipt.ts` multipart header bug** — delete the manual `"Content-Type": "multipart/form-data"` line; let the browser set it with the correct boundary.
5. **Update `docs/portals.md`** — reflect current code state and any new flows surfaced during pre-M3 work.

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
- Landlord store: `authSlice`, `uiSlice`, `notificationSlice`, `useLandlordStore`
- Landlord endpoints in `lib/api/endpoints.ts` — see `docs/api-contract.md` (to be written)
- Landlord MSW handlers + fixtures
- Payment confirmation hooks (`useConfirmPayment`, `useRejectPayment`) + MSW handlers that transition tenant-side payment state so the tenant's `useCurrentPayment` polling observes the change
- Landlord dashboard, tenants page, tenant detail page UI
- MSW payment-state selector (env var or `?mockState=` query param) + 4 fixture variants

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

#### Up Next
- Pre-M3 cleanup items 1–5 (target April 24 — **already overdue**, must close before backend scaffolding starts)
- File storage decision (offline + online split) — pending instructor confirmation
- Begin M3.1 (.NET API scaffold), M3.3 (Postgres + EF Core), and M3.11 setup (Testcontainers + Keycloak — start early)

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