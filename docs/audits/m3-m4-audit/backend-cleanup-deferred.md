# Backend Cleanup — Deferred Follow-ups

Tracking doc for items intentionally **not** done in the M3/M4 audit-remediation
Round 1 (see `backend-fixes-batch1.md`). Round 1 shipped: payment handler/validator
test coverage (Batch 1), three mechanical cleanups (Batch 2 — `InviteTokenHasher`,
`CacheKeys`, `AnthropicOcrOptions` relocation), the `ICurrentUserContext` abstraction
(Batch 3), and the `MarkExpiredInvites` + `OrphanCleanup` recurring Hangfire jobs
(Batch 4). Everything below was consciously left for a later round.

_Recorded 2026-06-03._

---

## 1. Mapperly retrofit — **NEXT PLAN (immediately after this one)**
Handlers currently hand-construct DTOs. Install Mapperly, add `[Mapper]` partial
classes per aggregate, and convert the ~19 hand-mapped handlers / ~11 DTOs. This
makes the existing `backend/CLAUDE.md` Mapperly claim true. Kept as the very next
batch, so the CLAUDE.md mapping section is deliberately left untouched for now.

## 2. Fully remove `ICurrentUser.Principal`
**Partially addressed in Batch 3.** The `KeycloakSubId → User` lookup and the
`currentUser.Principal!` dereference are now centralized behind `ICurrentUserContext`
(`GetUserAsync` / `GetOrSyncUserAsync`, impl `Infrastructure/Identity/CurrentUserContext.cs`);
no handler or controller touches `Principal` anymore — the single guarded read lives
only in `CurrentUserContext`. **Still deferred:** deleting `Principal` outright requires
reworking `IUserRepository.GetOrSyncFromClaimsAsync` to take sub/email/name (exposed on
`ICurrentUser`) instead of a `ClaimsPrincipal`. `NotificationsHub` intentionally keeps
using `Context.User` (a hub has no `IHttpContextAccessor`-backed principal, so
`ICurrentUserContext` does not apply there).

## 3. `MarkOverduePayments` recurring job
Deferred — needs a domain decision, not just plumbing. `PaymentStatus` has no `Overdue`
value and "overdue" is currently a pure read-time computation
(`LandlordDashboardRepository`: `Status == Outstanding && DueDate < today`), already
served by the partial index `IX_payments_DueDate_Outstanding`. A real job needs either a
new `PaymentStatus.Overdue` (+ migration + dashboard/frontend updates) or a
reminder-style job. Until then it stays a documented-but-unimplemented row in
`backend/CLAUDE.md` Background Jobs. (The other two documented jobs — `MarkExpiredInvites`,
`OrphanCleanup` — were implemented in Batch 4.)

## 4. Real-time event features
`InviteAccepted` / `InviteRejected` events + consumers + dispatcher methods, and a
`LeaseExpiringSoon` scan + push. The frontend `SignalRProvider` is also missing —
coordinate the two. Deferred.

## 5. Consumer resilience & OCR retry
In `IntegrationEventConsumerBase`: propagate `stoppingToken` (not `CancellationToken.None`),
extract the RabbitMQ correlation id into the Serilog `LogContext`, use
exponential-backoff-with-jitter reconnect (currently a flat 5 s), and add a DLQ for the
pure-SignalR consumers. Also add `[AutomaticRetry]` / a resilience handler to
`ReceiptOcrJob` and the Anthropic `HttpClient`. Deferred.

## 6. Minor leftovers
- Keycloak `bruteForceProtected: false` in the realm template (incl. Helm).
- Design-time `AppDbContextFactory` plaintext connection-string fallback (dev-only, low risk).
- IDOR existence leak (403 vs 404) on payment point-lookups.
- Persist OCR results to a dedicated `PaymentReceiptOcr` table (currently inline columns on `Payment`).
- Payment-rejection Model 1 → Model 2 (Rejected becomes terminal with a new superseding Outstanding row).
- Multi-tenancy global query filters.
