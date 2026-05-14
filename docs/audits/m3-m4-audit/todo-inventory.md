# TODO inventory — M3 close, pre-M4

**Audit date:** 2026-05-11  
**Auditor:** Claude Code (claude-sonnet-4-6)  
**Method:** full grep pass (TODO/FIXME/HACK/XXX/NOTE/Obsolete/deprecated/disabled-tests/hardcoded-dev-values/stubs/commented-out blocks) across `backend/`, `frontend/`, `infrastructure/`, `docs/`; validated against `docs/milestones/m3-backend-mvp.md`, `backend/CLAUDE.md`, `frontend/CLAUDE.md`, and `docs/audits/m3-m4-audit/m3-reconciliation.md`.

---

Total items: 34 unique  
- M4 blockers: 6  
- M5 blockers: 10  
- M5 bonus (multi-tenancy): 1  
- M6/M7 relevant: 5  
- Tech debt only: 12  
- Already tracked (cross-ref): 16 (most overlap with sections above; listed separately for completeness)

---

## M4 blockers

Items that will break or be flagged in a containerized / CI-CD / security-hardened environment. M4 ships May 22.

| # | File | Line | Item | Effort | Notes |
|---|---|---|---|---|---|
| 1 | `backend/MyProperty.Api/Program.cs` | 97–105 | `ValidateAudience = false` — loud TODO, May 6 target passed | trivial | Any Keycloak-realm token (wrong client) accepted by the API. Trivy/OWASP ZAP will flag. Fix requires audience mapper on a `myproperty-api` Keycloak client and matching `ValidAudience` in `Program.cs`. |
| 2 | `backend/MyProperty.Infrastructure/Persistence/AppDbContextFactory.cs` | 11 | Hardcoded `Host=localhost;Port=5432;Database=myproperty;Username=postgres;Password=postgres` | trivial | Design-time factory (used only by `dotnet ef migrations`); plaintext password committed to repo. `git-secrets` will catch it in CI. Switch to env var or user-secrets. |
| 3 | `docker-compose.yml` | ~89–93 | Grafana `GF_AUTH_ANONYMOUS_ENABLED: "true"` + `GF_AUTH_DISABLE_LOGIN_FORM: "true"` | trivial | Comment in file already says "local demo only." Must be disabled for any prod/staging Grafana; security hardening deliverable requires this. |
| 4 | `docker-compose.yml` | ~51–55 | RabbitMQ `RABBITMQ_DEFAULT_PASS: guest` hardcoded | trivial | Default credentials must be replaced via Key Vault/Secret Manager before any non-local environment. |
| 5 | *(not started)* | — | No production `Dockerfile` for the .NET API or the Next.js frontend | medium | Full-stack Docker Compose, prod Dockerfiles, distroless hardening — all M4 deliverables — require at least one container per service. Nothing exists today. |
| 6 | `docker-compose.yml` | — | `docker-compose.yml` has no `api` or `frontend` service — only infrastructure (Postgres, Keycloak, Redis, RabbitMQ, MailHog, Loki, Grafana) | small | Dev pattern is `dotnet run` on the host. M4 full-stack compose requirement means the API (and optionally the frontend) must become a service in the file. Blocked on #5. |

---

## M5 blockers

Items needed for full-stack integration (FS-2), security audit, or performance audit to be graded well. M5 ships May 29.

| # | File | Line | Item | Effort | Notes |
|---|---|---|---|---|---|
| 7 | *(not started)* | — | `docs/api-contract.md` referenced in `m3-backend-mvp.md:86` as "(to be written)" but never created | small | Without a shared contract, FE-BE integration has no agreed URL/shape surface. Swagger at `/swagger` is the de-facto source of truth but is only visible in dev/staging and not version-controlled. |
| 8 | `frontend/lib/api/endpoints.ts` | all | Every frontend endpoint key uses MSW-relative paths (`/tenant/lease`, `/landlord/dashboard`) — none have the `/api/v1/` prefix; half have no backend equivalent at all | large | `useCurrentPayment`, `useLease`, `usePaymentHistory`, `useLandlordUpcomingPayments`, `useLandlordTenants`, etc. all call endpoints that do not exist on the backend. A complete remap is required before a single real API call can succeed. |
| 9 | `frontend/lib/hooks/` | — | `useConfirmPayment` and `useRejectPayment` hooks do not exist | small | Landlord portal cannot confirm or reject payments from the UI; MSW handlers exist for mock use but the real hooks were never written. |
| 10 | `frontend/` | — | No `SignalRProvider` component exists anywhere in the frontend | small | `frontend/CLAUDE.md` specifies a top-level `SignalRProvider` with auto-reconnect; the backend hub is fully implemented (M3.6 complete); but the frontend half is missing entirely. |
| 11 | `frontend/app/dashboard/tenants/[id]/page.tsx` | 9 | Tenant detail page is a stub: `<h1>Tenant Detail (TODO M3)</h1>` | medium | Landlord cannot view tenant details or manage payments per tenant; blocks the landlord portal FE-BE flow. |
| 12 | `backend/MyProperty.Infrastructure/Jobs/` | — | Three recurring Hangfire jobs documented in `backend/CLAUDE.md` have no implementation: `MarkExpiredInvites` (hourly), `OrphanCleanup` (daily 03:00 UTC), `MarkOverduePayments` (daily 00:05 UTC) | small | No job classes, no `RecurringJob.AddOrUpdate` calls. The partial index from M3.4 (`IX_payments_DueDate_Outstanding`) was added specifically to make `MarkOverduePayments` fast — without the job, the index is never exercised. Orphan invite accumulation is also untouched. |
| 13 | `backend/.../AcceptInviteHandler.cs`, `RejectInviteHandler.cs` | — | Neither handler injects `IEventPublisher`; `InviteAccepted` / `InviteRejected` events are never published | small | No event record types exist under `Application/Invites/Events/`. No consumers registered. No `INotificationDispatcher` methods for invite notifications. Landlord gets no SignalR push when a tenant accepts or rejects an invite. Completes the M3.8 five-event set (2 of 5 still missing). |
| 14 | `backend/MyProperty.Application/Common/Interfaces/ICurrentUser.cs` | 44 | `ClaimsPrincipal? Principal` used with null-forgiving `!` in `AcceptInviteHandler` | trivial | `currentUser.Principal!` throws `NullReferenceException` if called from any non-HTTP context (future system-initiated path, Hangfire job, integration test without an HTTP principal). The null-forgiving operator suppresses the compiler warning. |
| 15 | `backend/MyProperty.Api/Hubs/` + `Application/Common/Notifications/INotificationDispatcher.cs` | — | `LeaseExpiringSoon` event not implemented: no `INotificationDispatcher` method, no Hangfire recurring scan job | small | Documented in `backend/CLAUDE.md` under Real-time events. Tenant has no way to receive a "lease expiring" push. Also blocks the Hangfire job list from matching the CLAUDE.md spec. |
| 16 | `backend/MyProperty.Tests/` | — | All four payment handlers (`CreatePayment`, `SubmitPayment`, `ConfirmPayment`, `RejectPayment`) and `DownloadReceiptHandler` have zero unit or integration test coverage | medium | M3.11 test suite covers invites and landlord dashboard only. Payment state machine has no automated safety net — a regression in the core business flow won't be caught by CI. M5 security/performance audit will note this. |

---

## M5 bonus — multi-tenancy candidates

| # | File | Line | Item | Effort | Notes |
|---|---|---|---|---|---|
| 17 | `backend/CLAUDE.md` "Post-M3 follow-ups" | — | Keycloak admin client not implemented — only seeded users (with `Tenant` role pre-assigned in `realm-export.json`) can accept invites end-to-end | medium | Any real new user who signs in via Google SSO gets a JWT without the `Tenant` role and hits 403 on all tenant endpoints after accepting an invite. Keycloak admin API is needed to programmatically assign the role at accept time. This is the single largest correctness gap blocking multi-tenant onboarding. The data model (LandlordId-scoped queries, resource-scoped authorization per handler) is already multi-tenant in shape; the provisioning path is the missing link. |

---

## M6/M7 relevant

Items that affect the live demo, final README, or the demo experience that graders see.

| # | File | Line | Item | Effort | Notes |
|---|---|---|---|---|---|
| 18 | `frontend/app/dashboard/properties/page.tsx` | 2 | Properties page is a bare `<h1>Properties</h1>` stub | large | Demo-blocking: landlord portal has no property CRUD or list. One of three landlord nav items leads to an empty heading. |
| 19 | `frontend/app/dashboard/tenants/page.tsx` | 2 | Tenants list page is a bare `<h1>Tenants</h1>` stub | medium | Landlord sees a heading instead of a tenant roster. Pairs with #11 (tenant detail stub). |
| 20 | `frontend/app/components/LandingPage.tsx` | — | Landing page, login form, and signup form are a single 500-line combined component that does not reflect the role-aware auth model | medium | Flagged in `m3-backend-mvp.md` "Frontend follow-ups." Confusing for a live demo; roles and portals aren't visible in the entry flow. |
| 21 | `frontend/components/ui/Sidebar.tsx` | — | Mobile drawer has no visible close button; user closes via backdrop click or Escape only | trivial | Carried from M2 / L1 known gaps. Demo may run on a laptop in mobile viewport; missing close affordance is obvious. |
| 22 | `docs/performance/m3-redis-caching/README.md` | — | Headline benchmark table shows `_TBD_` placeholders — bench harness committed but never run against a live stack | trivial | M3.5 is marked ✅ done but the documented proof (before/after numbers) is missing. Run `docs/performance/m3-redis-caching/bench/` against the seeded dataset to fill in the numbers. |

---

## Tech debt only (defer)

No milestone impact; can wait until post-M7 or as opportunistic cleanup.

| # | File | Line | Item | Effort | Notes |
|---|---|---|---|---|---|
| 23 | `CreateInviteHandler.cs`, `AcceptInviteHandler.cs`, `RejectInviteHandler.cs`, `GetInviteByTokenHandler.cs`, `InvitePreviewAndRejectTests.cs`, `TestUtils/TokenHasher.cs` | — | `HashToken` SHA256 static method duplicated six times across handlers and tests | trivial | Extract to `Application/Invites/InviteTokenHasher.cs`; delete `TestUtils/TokenHasher.cs` and replace usages. Documented in `backend/CLAUDE.md`. |
| 24 | 5 payment handlers (`CreatePayment`, `SubmitPayment`, `ConfirmPayment`, `RejectPayment`, and `DownloadReceipt`) | — | `KeycloakSubId → User` lookup pattern copy-pasted in every payment handler | small | Each handler: `if (currentUser.KeycloakSubId is null) throw ForbiddenException` + `userRepo.GetByKeycloakSubIdAsync`. Extract to `ICurrentUserContext` in `Application/Common/`. Documented in `backend/CLAUDE.md` and progress log. |
| 25 | `backend/MyProperty.Application/Common/Interfaces/ICurrentUser.cs` | 40–44 | `ClaimsPrincipal? Principal` is an acknowledged abstraction leak | small | Only exists because `IUserRepository.GetOrSyncFromClaimsAsync` takes a `ClaimsPrincipal`. Blocked on Keycloak admin client landing (#17). Remove once role sync moves server-side. |
| 26 | `frontend/app/dashboard/_components/DashboardShell.tsx` | 10–14 | Stale TODO warning that `MockProvider`/`KeycloakInit` are not in the dashboard layout | trivial | `app/dashboard/layout.tsx` already has both. Comment should be deleted. |
| 27 | `frontend/lib/hooks/useTenantAccount.ts` | — | Hook calls `ENDPOINTS.tenantAccount` which resolves to `/tenant/me` — no backend equivalent | trivial | Backend has `GET /api/v1/me`. Either stale or a placeholder for a future `/me/tenant` endpoint. The `m3-backend-mvp.md` Defer section notes this hook is "harmless" until it's needed for read-only banner logic. |
| 28 | `backend/CLAUDE.md` — Mapping section | — | Mapperly described as the mapping approach ("All entity ↔ DTO mapping uses Mapperly source generators") but is not installed in any `.csproj` | trivial | Every handler constructs DTOs by hand. CLAUDE.md describes the intended post-M3 retrofit, not current state. |
| 29 | `backend/MyProperty.Tests/Integration/Fixtures/ApiFixture.cs` | 129 | Cache key `landlord:{landlordId}:dashboard` hardcoded in test fixture | trivial | `RedisLandlordDashboardCache` computes this key via a private `KeyFor` method. Test fixture should use a shared constant or the cache interface itself, not a string literal. |
| 30 | `frontend/app/dashboard/LandlordDashboard.tsx` | 181 | Whole-page error state if either dashboard query fails | small | If the upcoming-payments query fails independently, the entire dashboard disappears. Should be per-section error states. Tracked in `m3-backend-mvp.md` Frontend follow-ups. |
| 31 | `frontend/app/dashboard/_components/AccountBlock.tsx` | 18 | User initials derived from first character of email, not from a name field | trivial | TODO comment notes this is a placeholder until `/me` returns landlord profile data. Low-priority polish. |
| 32 | `backend/MyProperty.Infrastructure/Messaging/Consumers/` | — | SignalR-push consumers have no dead-letter handling; a flaky push drops silently with a `Warning` log only | small | `PaymentConfirmedConsumer` has the full email + SignalR path and benefits from Hangfire's retry for the email leg. Pure SignalR consumers (`PaymentSubmitted`, `PaymentRejected`, `PaymentCreated`) ack the message on consume regardless of whether the `INotificationDispatcher` call succeeds. |
| 33 | `backend/MyProperty.Application/Payments/` (state machine) | — | Payment rejection is Model 1 (loop): `Rejected` row is reusable, `SubmitPayment` accepts `Rejected` and clears rejection metadata | large | Long-term model is terminal `Rejected` with supersession FK. Requires schema migration, query rewrites for "current payment for lease X period Y," handler change, and `PaymentHistory` display decision. Documented with full trade-off analysis in `m3-backend-mvp.md`. |
| 34 | `backend/MyProperty.Infrastructure/Ai/` + `ReceiptOcrJob.cs` | — | OCR results stored as 5 nullable columns on `Payment` (`OcrAmount`, `OcrDate`, `OcrMerchant`, `OcrProcessedAt`, `OcrRawResponse`) including unbounded text on a query-hot entity | small | Extract to `PaymentReceiptOcr` table (FK to `Payment`, unique today). No external consumers — cutover is internal-only. Documented in `m3-backend-mvp.md` M3.9 post-M3 section. |

---

## Already tracked in m3-backend-mvp.md / CLAUDE.md

All items below are explicitly listed in the post-M3 follow-up sections of `m3-backend-mvp.md` or `backend/CLAUDE.md`. They are confirmed still open in code as of this audit. Items that also appear in the milestone-impact tables above are noted.

| # | Tracked in | Item | Still open? | Also in |
|---|---|---|---|---|
| T1 | `m3-backend-mvp.md` May 2 Known Gaps | `ValidateAudience = false` | ✅ `Program.cs:105` unchanged | M4 blocker #1 |
| T2 | `backend/CLAUDE.md` post-M3 Invites section | Keycloak admin client for tenant role assignment | ✅ no admin client code anywhere | M5 bonus #17 |
| T3 | `backend/CLAUDE.md` Architecture Patterns — Mapping | Mapperly retrofit | ✅ not in any `.csproj` | Tech debt #28 |
| T4 | `backend/CLAUDE.md` post-M3 Invites section | Remove `ClaimsPrincipal? Principal` from `ICurrentUser` | ✅ still in `ICurrentUser.cs:44` | Tech debt #25 |
| T5 | `backend/CLAUDE.md` post-M3 Invites section | Extract `HashToken` to `InviteTokenHasher.cs`; delete `TestUtils/TokenHasher.cs` | ✅ still duplicated in 6 places | Tech debt #23 |
| T6 | `backend/CLAUDE.md` post-M3 Invites section + payment batch notes | Extract `ICurrentUserContext` for `KeycloakSubId → User` lookup | ✅ still in all 5 payment handlers | Tech debt #24 |
| T7 | `backend/CLAUDE.md` Message Queue section + `m3-backend-mvp.md` May 4 cut list | `InviteAccepted` / `InviteRejected` RabbitMQ events | ✅ no event types, no consumers | M5 blocker #13 |
| T8 | `m3-backend-mvp.md` Frontend follow-ups | Payment rejection Model 1 → Model 2 (terminal + supersession FK) | ✅ still Model 1 | Tech debt #33 |
| T9 | `m3-backend-mvp.md` M3.9 post-M3 | Extract OCR results to `PaymentReceiptOcr` table | ✅ still 5 nullable columns on `Payment` | Tech debt #34 |
| T10 | `m3-backend-mvp.md` Frontend follow-ups | Per-section error states on `LandlordDashboard` | ✅ still whole-page error | Tech debt #30 |
| T11 | `m3-backend-mvp.md` Frontend follow-ups | SignalR wiring for landlord TanStack Query invalidation (`queryClient.invalidateQueries` on hub events) | ✅ no `SignalRProvider` at all | M5 blocker #10 |
| T12 | `m3-backend-mvp.md` Frontend follow-ups | Landing / login / signup separation | ✅ still one 500-line component | M6/M7 #20 |
| T13 | `m3-backend-mvp.md` Frontend follow-ups | Sidebar mobile close button | ✅ still no close button | M6/M7 #21 |
| T14 | `m3-backend-mvp.md` Frontend follow-ups (NEXT_PUBLIC_API_BASE_URL) | Production wiring: Next.js rewrites vs. direct absolute calls; `NEXT_PUBLIC_API_BASE_URL` unset in dev | ✅ TBD — `lib/api/client.ts` tolerates missing var | Part of M5 blocker #8 |
| T15 | `m3-backend-mvp.md` Defer | `useTenantAccount` dead-code decision | ✅ hook exists, calls a misaligned endpoint | Tech debt #27 |
| T16 | `backend/CLAUDE.md` post-M3 Invites section (last bullet) | Cache key string `landlord:{landlordId}:dashboard` should reference a shared constant | ✅ hardcoded in `ApiFixture.cs:129` and in handler comments | Tech debt #29 |

---

## Top 10 to prioritize first

Ranked by: days-to-deadline of the milestone they block, how many other items they unblock, and how long they'll take.

**1. Production Dockerfiles for API and frontend (#5)**  
M4 is 11 days away and its entire grade is infra. Without a `Dockerfile` for the .NET API, there is no containerized stack, no CI pipeline for containers, no Kubernetes/Helm, no Nginx/SSL, no Trivy scan surface. Every other M4 deliverable starts here.

**2. Add `api` (and optionally `frontend`) service to `docker-compose.yml` (#6)**  
Depends on #1. Once the API has a Dockerfile, the full-stack compose that M4 requires is one service block away. This also forces the first real end-to-end integration test of the container config.

**3. Fix `ValidateAudience = false` (#1 / T1)**  
Trivial fix (20 minutes: add audience mapper to `realm-export.json`, set `ValidateAudience = true` + `ValidAudience = "myproperty-api"` in `Program.cs`). Has missed its deadline twice. Trivy will flag the open validation in M4's security hardening pass. Also an OWASP ZAP finding for M5.

**4. Write `docs/api-contract.md` (#7)**  
One document, can be generated from the Swagger JSON that already exists. Without it, the frontend endpoint alignment (#8) has no agreed target — every hour of frontend API work done before this is potentially wasted.

**5. Frontend endpoint alignment (#8)**  
The largest single item on this list. Half the tenant-side views have no backend equivalent (`/tenant/lease`, `/tenant/payments/current`, `/tenant/payments/history`, `/tenant/payments/receipt`). This is the core M5 FE-BE integration work and it needs to start immediately. Write `api-contract.md` first (#4) to define the target before touching `endpoints.ts`.

**6. Implement recurring Hangfire jobs (#12)**  
Three jobs documented in CLAUDE.md, none implemented. `MarkOverduePayments` is the highest priority of the three: the partial index from M3.4 exists specifically to serve it — without the job, the index is dead weight and the overdue-payment counts in the dashboard are always stale. Small effort (three job classes + three `RecurringJob.AddOrUpdate` calls in `Program.cs`).

**7. Wire `InviteAccepted` / `InviteRejected` events (#13 / T7)**  
Small effort: define two event records, inject `IEventPublisher` into both invite handlers, add two consumers. Completes the M3.8 five-event set and gives landlords real-time SignalR pushes on invite state changes. Unblocks FE-BE invite flow testing.

**8. `useConfirmPayment` + `useRejectPayment` hooks (#9)**  
Two TanStack Query mutations, straightforward. Without them the landlord cannot confirm or reject payments from the UI — the state machine's most important operations have no UI entry point. Small effort, high visible impact for FE-BE integration.

**9. `SignalRProvider` component (#10 / T11)**  
Backend hub (M3.6) is fully implemented. Frontend `CLAUDE.md` specifies a top-level provider with `withAutomaticReconnect()`. Small effort to write. Without it, no `queryClient.invalidateQueries` on SignalR events — the real-time feature is back-end-only and untestable end-to-end.

**10. Payment handler test coverage (#16)**  
The payment state machine is the most business-critical code in the backend and has zero automated coverage. Before M5 security/performance audits, this is the highest-risk gap. `CreatePayment`, `SubmitPayment`, `ConfirmPayment`, `RejectPayment` validators and handlers — plus `DownloadReceiptHandler` — need at minimum unit tests with Moq following the existing invite-handler test pattern. Medium effort but the pattern is already established in the test project.
