# Multi-tenancy readiness

## TL;DR

The codebase is structurally well-positioned for the discriminator-column multi-tenancy pattern: four of five business entities carry a direct `LandlordId` FK column, and all current write handlers enforce ownership via ad-hoc landlord-scoping checks derived from the JWT. There is no global EF Core query filter for landlord scope (only soft-delete is global), and the `Payment` entity lacks a direct `LandlordId` column, requiring a one-hop join through `Lease` for any landlord-scoped filter. Because no listing endpoints exist yet (every read is either a point-lookup-with-ownership-check or an explicitly scoped aggregate), there are currently zero cross-tenant data leakage paths in production code. Closing the gaps to claim FS-10 + the +3% bonus requires: adding `LandlordId` to `Payment`, wiring a scoped "current landlord" service into the `DbContext`, and adding `HasQueryFilter` to the four scoped entities — roughly **2–3 days of backend work**. That effort is worth pursuing if M5 has slack, and the structural groundwork is already there to make it mechanical rather than architectural.

---

## Entity scope map

| Entity | Has LandlordId? | Reachable via | Scope enforcement |
|---|---|---|---|
| `User` | No | N/A — is the root identity for both landlords and tenants | Not scoped; intentional. Landlord = SaaS org owner; User table is shared identity store. |
| `Property` | **Yes** (`Property.LandlordId`) | Direct FK → User | Ad-hoc per handler (`CreateInviteHandler` checks `property.LandlordId != landlord.Id`). Index on `LandlordId` exists. No global filter. |
| `Lease` | **Yes** (`Lease.LandlordId`) | Direct FK → User | Ad-hoc per handler (`CreatePaymentHandler` checks `lease.LandlordId != landlord.Id`). Composite index `(LandlordId, Status)` exists. No global filter. |
| `Payment` | **No** | `Payment.LeaseId → Lease.LandlordId` (one hop) | Ad-hoc per handler (Confirm/Reject/Submit all load the lease and check `Lease.LandlordId`). `GetByIdWithLeaseAsync` is the only repo read method — always includes the Lease nav for the ownership check to work. No global filter. |
| `Invite` | **Yes** (`Invite.LandlordId`) | Direct FK → User | Ad-hoc per handler (`CreateInviteHandler` sets it; anonymous token-scoped handlers don't need landlord isolation). Composite index `(LandlordId, Status)` exists. No global filter. |
| `FailedEmail` | No | Not reachable from a landlord | Operational/infrastructure table. Only the Admin role accesses it (via Hangfire dashboard). Intentionally un-scoped. |

---

## Handler scope audit

| Handler | Scopes by | How derived | Gap? |
|---|---|---|---|
| `GetLandlordDashboardHandler` | `LandlordId` | JWT `sub` → `GetOrSyncFromClaimsAsync` in controller → `landlord.Id` passed as query param | None. All 5 sub-queries in `LandlordDashboardRepository` filter explicitly by `landlordId`. Cache key `landlord:{landlordId}:dashboard` is correctly scoped. |
| `CreatePaymentHandler` | `LandlordId` | JWT `sub` → `GetByKeycloakSubIdAsync` → `landlord.Id`; then `lease.LandlordId != landlord.Id` check | None for the write path. `LeaseRepository.GetByIdAsync` is unscoped (by ID only); ownership validated immediately after. |
| `SubmitPaymentHandler` | `TenantId` | JWT `sub` → `GetByKeycloakSubIdAsync` → `tenant.Id`; then `payment.Lease!.TenantId != tenant.Id` check | Minor IDOR: `GetByIdWithLeaseAsync` fetches any payment by ID with no scope; caller receives 403 (not 404) if they probe a foreign payment ID. Leaks existence, not data. |
| `ConfirmPaymentHandler` | `LandlordId` | JWT `sub` → `GetByKeycloakSubIdAsync` → `landlord.Id`; then `payment.Lease!.LandlordId != landlord.Id` check | Same minor IDOR pattern as above. |
| `RejectPaymentHandler` | `LandlordId` | JWT `sub` → `GetByKeycloakSubIdAsync` → `landlord.Id`; then `payment.Lease!.LandlordId != landlord.Id` check | Same minor IDOR pattern as above. |
| `DownloadReceiptHandler` | `TenantId` OR `LandlordId` | JWT `sub` → `GetByKeycloakSubIdAsync`; then dual check: `TenantId == user.Id \|\| LandlordId == user.Id` | None. Correctly allows both parties on the lease. Same minor IDOR existence leak. |
| `CreateInviteHandler` | `LandlordId` | JWT `sub` → `GetOrSyncFromClaimsAsync` → `landlord.Id`; then `property.LandlordId != landlord.Id` check | None. |
| `AcceptInviteHandler` | Token + email match | Token → `GetByTokenHashAsync`; user derived from JWT → `GetOrSyncFromClaimsAsync`; `user.Email != invite.Email` check | None. The token is the scope; email match prevents one tenant from accepting another's invite. |
| `RejectInviteHandler` | Token only (anonymous) | Token → `GetByTokenHashAsync` | No data leak — action is status change to `Rejected` on a record the caller already knows about (they received the invite email). Intentionally anonymous by design. |
| `GetInviteByTokenHandler` | Token only (anonymous) | Token → `GetByTokenHashAsync` | No data leak — token is cryptographically opaque (32 random bytes, SHA-256 hashed in DB). Returns 404 for non-Pending/expired. |

---

## Failure modes found

### Cross-tenant data leakage paths
**None currently present.** Every read endpoint either:
- Uses a cryptographic token as the scope (invite token handlers), or
- Is a point-lookup-then-ownership-check (all payment handlers), or
- Explicitly filters by the authenticated landlord's ID (dashboard repository).

There are no list/collection endpoints in the codebase today. The repositories expose `GetById*` methods and aggregate counts, not `GetAll()`. This is the primary reason there are no current leakage paths: you cannot enumerate records you don't have the ID for.

### IDOR existence leak (low severity)
All three payment point-lookup handlers (`ConfirmPaymentHandler`, `RejectPaymentHandler`, `SubmitPaymentHandler`, `DownloadReceiptHandler`) call `paymentRepo.GetByIdWithLeaseAsync(id)` — which is unscoped — and then validate ownership. A caller who probes a payment ID belonging to a different landlord receives **403 Forbidden** (not 404 Not Found). This leaks the fact that the ID is a valid payment record. It does not leak any payment data. Fixable by returning 404 unconditionally on ownership failure, or by scoping the repository query.

### Unscoped admin endpoints
The Hangfire dashboard (`/hangfire`) is protected by `AdminOnlyDashboardFilter`, which requires `Identity.IsAuthenticated == true && IsInRole("Admin")`. This is **intentionally cross-tenant** (admins observe all jobs, including email bodies). There are no other Admin-role REST endpoints in the current codebase. This is not a gap — it is correct behavior.

### Missing global query filters
There is exactly one global query filter on `AppDbContext`: soft-delete (`DeletedAt == null`). There is no global landlord-scoping filter. Landlord isolation is enforced entirely ad-hoc in each handler or repository method. This is not currently a leakage risk (because listing is not implemented), but it is the principal gap between "we have scoping" and "we have formal multi-tenant isolation."

### Unscoped caches
The Redis cache currently holds only one data shape: `landlord:{landlordId}:dashboard`. This key is correctly scoped by `landlordId` in both `RedisLandlordDashboardCache.KeyFor()` and invalidation calls in all relevant handlers (`ConfirmPaymentHandler`, `RejectPaymentHandler`, `SubmitPaymentHandler`, `CreatePaymentHandler`, `AcceptInviteHandler`). No other cached values exist. No unscoped cache entries present.

### Background job context
`ReceiptOcrJob` calls `db.Payments.FirstOrDefaultAsync(p => p.Id == paymentId)` directly on `AppDbContext` without any landlord scope. This is fine today because: (a) the job is invoked with a specific, already-validated payment ID, (b) there is no global landlord filter to bypass. If a global filter were added via `IHttpContextAccessor`, background job contexts (no HTTP request) would need `IgnoreQueryFilters()` or a separate "system" DbContext scope. This is a known challenge with global query filters in mixed HTTP/background contexts.

---

## Recommendation

**Option (b): We have partial scoping; closing the gaps is ~2–3 days of work. Worth pursuing for the +3% if M5 has slack.**

The structural work is largely done. `Property`, `Lease`, and `Invite` already carry `LandlordId` directly. The discriminator-column pattern just needs to be made formal and automatic rather than per-handler. Specific steps to get there:

1. **Add `LandlordId` to `Payment`** (one migration). This eliminates the one-hop join and makes a global filter on `Payment` straightforward.

2. **Introduce a scoped `ICurrentLandlordContext` service** that resolves the current user's internal `Guid landlordId` (from `ICurrentUser.KeycloakSubId` → `UserRepository`) and is accessible to the `DbContext`. This replaces the repeated `KeycloakSubId → User lookup` pattern duplicated across five handlers.

3. **Add `HasQueryFilter` to four entities** in `AppDbContext` (`Property`, `Lease`, `Payment`, `Invite`), filtering on `LandlordId == currentContext.LandlordId`. Use a null-guard (filter is a no-op when `LandlordId` is not set on the context) to keep background jobs and anonymous endpoints working without `IgnoreQueryFilters()` scattered everywhere.

4. **Document the pattern** in `backend/CLAUDE.md` under a new "Multi-tenancy" section — specifically: discriminator column, global filter, how Admin and background contexts bypass it.

What this does **not** require: schema-per-tenant, a new table, or changes to Keycloak. The existing `realm_access.roles` and Keycloak-issued JWTs are sufficient. The Admin role's intentionally cross-tenant access to Hangfire continues to work unchanged.

If M5 has no slack, the minimum viable FS-10 claim is: document the current discriminator-column presence (`LandlordId` on Property, Lease, Invite; reachable for Payment via Lease), document the ad-hoc per-handler enforcement pattern, and note the absence of listing endpoints as a current mitigating control. That satisfies "single-landlord-per-user assumption documented" without the +3% bonus. The +3% requires the global query filter and the `Payment.LandlordId` denormalization.
