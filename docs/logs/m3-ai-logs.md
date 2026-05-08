# Milestone 3 AI Logs

## Summary

These are the conversations that were made with AI for consultation,
implementation, and quality review during the third milestone of the project —
the .NET 10 backend MVP. The deliverable for **M3.15** is to document AI usage
across four specific areas: **API generation**, **query optimization**,
**debugging**, and **security**. Entries are grouped under those headings so
coverage is auditable; within each section entries are roughly chronological.

| Area | Entries |
|---|---|
| API generation        | 1 – 4 |
| Query optimization    | 5 – 7 |
| Debugging             | 8 – 11 |
| Security              | 12 – 14 |

Tools used in this milestone: Claude (Sonnet 4.6 / Opus 4.7) via Claude Code,
ChatGPT for one-off explanations, Anthropic Console for prompt iteration on
planning prompts.

---

## API generation

### Entry 1 — 28/04/2026

**Tool used:** Claude Opus 4.7 — Planned the Clean Architecture scaffold for the
.NET 10 backend (M3.1).

**Prompt / input:**
> Plan the M3.1 deliverable: a .NET 10 backend in four projects (Api,
> Application, Domain, Infrastructure) with strict dependency rules,
> URL-versioned endpoints under `/api/v1/`, Swagger from XML comments, and an
> RFC 7807 error envelope via `IExceptionHandler`. Output should be precise
> enough for Claude Code to execute without asking follow-up questions.

**Output quality:** The plan came back with the four-project layout, the
`ProblemTypes` URI table under `https://myproperty.app/errors/`, the
`GlobalExceptionHandler` mapping for `NotFoundException` /
`ValidationException` / `ForbiddenException`, and an explicit "no MediatR"
note. One correction needed: the initial plan had the FluentValidation
auto-registration in the wrong project — moved from Infrastructure to Api per
the layering rules in CLAUDE.md.

**Time saved estimate:** ~3 hours. Bootstrapping a Clean Architecture solution
from scratch — picking package versions, wiring `Asp.Versioning.Mvc`,
configuring Swagger XML inclusion — usually involves several round trips with
the dotnet CLI and StackOverflow.

**Lessons learned:**
- Pasting the existing `backend/CLAUDE.md` in the planning prompt produced a
  plan that respected layering decisions (no DbContext in Application, no
  IQueryable across boundaries) without me having to remind it.
- Asking the planner to be "precise enough to execute without follow-up
  questions" cut the back-and-forth with Claude Code by half.

---

### Entry 2 — 04/05/2026

**Tool used:** Claude Sonnet 4.6 (Claude Code) — Generated the four payment
command/handler/validator triples (Create, Submit, Confirm, Reject) plus the
state-machine guards.

**Prompt / input:**
> Implement the four payment commands with the state machine
> `Outstanding → Pending → Confirmed | Rejected`, and the resubmission edge case
> where a rejected row goes directly back to `Pending` on the tenant's next
> submit. Each handler must (1) enforce resource-scoped authorization (tenant
> owns the lease, landlord owns the lease), (2) invalidate the
> `landlord:{id}:dashboard` cache after the commit, (3) leave a TODO for the
> M3.8 publish.

**Output quality:** All four handlers came back consistent — same
`ICurrentUser → IUserRepository → state guard → save → cache invalidation`
shape. The Rejected → Pending edge case was honoured: `RejectedAt` and
`RejectionReason` are cleared on entry to `Pending`. One real bug found in
review: the initial `SubmitPaymentHandler` used `payment.Lease.LandlordId`
without `!.` after the include — would have been a nullable warning under
`TreatWarningsAsErrors`. Caught before commit.

**Time saved estimate:** ~2 hours. The repetitive structure across four
handlers is exactly where Claude Code shines.

**Lessons learned:**
- Document edge cases in the planning prompt (resubmission, terminal states,
  cache invalidation triggers) — vague prompts produce vague handlers.
- `TreatWarningsAsErrors` is the second reviewer that catches everything Claude
  Code missed.

---

### Entry 3 — 06/05/2026

**Tool used:** Claude Sonnet 4.6 (Claude Code) — Implemented M3.8 RabbitMQ
event-driven flow end to end (publisher abstraction, four event publishes,
hosted-service consumer translating `payment.confirmed` → Hangfire email job).

**Prompt / input:**
> Wire RabbitMQ for payment events. Publisher in Application as
> `IEventPublisher`, implementation in Infrastructure with `RabbitMQ.Client` v7
> async API. Topic exchange `myproperty.events`, routing keys derived from CLR
> type name (`PaymentConfirmedEvent` → `payment.confirmed`). One hosted-service
> consumer that subscribes to `payment.confirmed` and enqueues a Hangfire
> confirmation email. Tests must run without a real broker.

**Output quality:** The split between `IEventPublisher` (Application) and
`RabbitMqEventPublisher` (Infrastructure) was clean. The publisher catches
transport failures and logs (DB row is the source of truth). The consumer
declares its own queue (`myproperty.payment.confirmed.email`), uses manual ack
+ prefetch 1, requeues on transient failures, and rejects poison messages
without requeue. The test factory got a `RecordingEventPublisher` and a
`RabbitMq:Enabled=false` flag so the suite never opens an AMQP socket. One
follow-up needed: I asked Claude to extract an `IntegrationEventConsumerBase<T>`
when the SignalR work in M3.6 added three more consumers.

**Time saved estimate:** ~5 hours. This was the most code-heavy entry of the
milestone — full async publisher + hosted-service consumer + connection
provider + DI wiring + test substitutions.

**Lessons learned:**
- Asking for "tests must run without a real broker" up front made Claude design
  the `Enabled=false` toggle from the start instead of tacking it on after.
- RabbitMQ.Client v7 has a fully async API — calling out the version explicitly
  in the prompt avoided a v6 pattern leaking in.

---

### Entry 4 — 08/05/2026

**Tool used:** Claude Opus 4.7 (Claude Code) — Implemented the M3.6 SignalR
hub, Redis backplane, four event consumers, and the `INotificationDispatcher`
abstraction.

**Prompt / input:**
> Implement M3.6. Single hub at `/hubs/notifications`, JWT bearer auth with
> `?access_token=` query-string fallback restricted to `/hubs/*`, server-assigned
> groups `tenant:{userId}` / `landlord:{userId}` based on JWT roles + a lookup
> through `IUserRepository`. Push four payment events from RabbitMQ consumers,
> not from handlers. Consumers must depend on an Application-layer abstraction,
> not `IHubContext<NotificationsHub>` directly, because Infrastructure cannot
> reference Api.

**Output quality:** The `INotificationDispatcher` (Application) +
`SignalRNotificationDispatcher` (Api) split kept the layering clean — no
project reference cycles. The hub aborts connections that haven't been synced
into the user table yet, with a log line telling the frontend to retry after a
REST round-trip. The four consumers all derive from the same
`IntegrationEventConsumerBase<TEvent>` that came out of the M3.8 refactor —
saved ~600 lines of duplication. The Redis backplane is toggleable via
`SignalR:UseRedisBackplane` so tests skip the StackExchange.Redis wiring.

**Time saved estimate:** ~6 hours. Hub auth, group assignment, backplane
config, and four consumers in one session would have been a long day of
StackOverflow archaeology otherwise.

**Lessons learned:**
- When the layering rule (Infrastructure ↛ Api) collides with what you want to
  do, the answer is almost always "introduce an interface in Application."
  Prompting Claude with the rule directly produced this design without me
  having to suggest it.
- Restricting the query-string token lift to `/hubs/*` paths is a small detail
  worth being explicit about in the prompt — the default StackOverflow
  examples lift it for every request.

---

## Query optimization

### Entry 5 — 03/05/2026

**Tool used:** Claude Sonnet 4.6 — Profiled the landlord upcoming-payments
dashboard query (Q1 in M3.4) using `EXPLAIN (ANALYZE, BUFFERS)`.

**Prompt / input:**
> Here's the EF-generated SQL for `GetLandlordDashboardQuery` and the
> `EXPLAIN (ANALYZE, BUFFERS)` output before and after dropping
> `IX_payments_LeaseId_Status`. The before run is 16.363 ms, after is
> 0.739 ms — ~22× faster. Is the index doing what I think it is, or is the
> speedup a fluke of cold caches?

**Output quality:** Claude walked through the plan node by node — confirmed
the index turned a `Seq Scan + Hash Join` into a `Bitmap Heap Scan` driven by
the index, pointed out that the warm/cold differential ratio was consistent
with index access vs sequential scan, and flagged that the planner was using
the index on `LeaseId` first and the `Status` predicate as a pushdown. No
fluke. The follow-up note about leveraging `Landlord` on `properties` separately
was useful.

**Time saved estimate:** ~1 hour. Reading EXPLAIN output is a learnable skill
but slow; a second pair of eyes on the plan tree confirmed I wasn't fooling
myself with cherry-picked timings.

**Lessons learned:**
- Always paste both the before and after EXPLAIN output, not just the timing
  delta — the plan shape is what tells you whether the speedup will hold under
  scale.
- "Is this real or a fluke?" is a useful framing for an AI review of
  performance work.

---

### Entry 6 — 03/05/2026

**Tool used:** Claude Sonnet 4.6 — Diagnosed why a naive full-column index on
`Payment.DueDate` was *slower* than no index at all (Q2 in M3.4).

**Prompt / input:**
> Adding `CREATE INDEX IX_payments_DueDate ON payments(DueDate)` made the
> Hangfire overdue-scan query slower — 8.981 ms with the index vs 4.616 ms
> without. The query is `WHERE DueDate < today AND Status = 'Outstanding' AND
> DeletedAt IS NULL`. Why?

**Output quality:** The diagnosis was immediate and correct: `DueDate < today`
matches roughly 74% of rows in this dataset, so the planner walks most of the
index *and* still has to visit the heap to check `Status` and `DeletedAt`.
Claude proposed the partial index that ended up landing —
`IX_payments_DueDate_Outstanding` filtered on
`Status = 'Outstanding' AND DeletedAt IS NULL`. That dropped the warm time to
0.045 ms (~103×) and produced an `Index Only Scan` because the partial
predicate matches the query predicate exactly.

**Time saved estimate:** ~2 hours. The "more indexes are always better" intuition
is wrong here, and unwinding it through trial and error would have taken
multiple migration cycles.

**Lessons learned:**
- A b-tree on a column where the WHERE clause matches a high fraction of rows
  is often a pessimisation, not an optimisation — the partial index is the
  fix.
- This lesson is now documented in `backend/CLAUDE.md` under Database → Indexes
  with a pointer to the M3.4 README.

---

### Entry 7 — 04/05/2026

**Tool used:** Claude Sonnet 4.6 — Designed the cache-aside contract for the
landlord dashboard (M3.5) and identified all the write paths that need to
invalidate the entry.

**Prompt / input:**
> The landlord dashboard aggregates property/tenant/payment counts and is hit
> on every landlord page load. Plan the cache-aside layer: interface in
> Application (`ILandlordDashboardCache`), Redis-backed implementation, key
> convention `landlord:{landlordId}:dashboard`, 60s TTL, and an audit of every
> write path that should invalidate the entry.

**Output quality:** The interface came back small (read, write, invalidate),
the Redis impl swallows transport errors and logs (graceful degradation back
to the DB-backed query). The invalidation audit was the genuinely useful
part: Claude listed every handler that mutates a counter visible on the
dashboard — `CreatePaymentHandler`, `SubmitPaymentHandler`,
`ConfirmPaymentHandler`, `RejectPaymentHandler`, and `AcceptInviteHandler`
(new lease shifts active-tenants count) — all of which now call
`dashboardCache.InvalidateAsync(landlordId, ct)` after `SaveChangesAsync`.

**Time saved estimate:** ~1.5 hours. The invalidation audit alone would have
taken longer than the implementation; missing one path would have meant stale
data on the dashboard for up to 60 seconds after a write.

**Lessons learned:**
- For cache-aside, the hard work is the invalidation audit, not the
  implementation. A dependency map of "write path → cache key" should be in
  the prompt itself.
- Swallowing Redis transport errors is the right default for a cache — the DB
  is the source of truth, so a flaky cache should never fail a request.

---

## Debugging

### Entry 8 — 02/05/2026

**Tool used:** Claude Sonnet 4.6 — Diagnosed `TreatWarningsAsErrors` failures
across the four projects after the initial M3.1 scaffold.

**Prompt / input:**
> The build fails with CS8618 (non-nullable property uninitialised) on
> `BaseEntity` and several DTO records, plus CS1591 (missing XML comment) on
> the public types in `Application/Common/Interfaces/`. Should I weaken
> `TreatWarningsAsErrors`, or is there a structural fix?

**Output quality:** Claude pushed back on weakening the setting — recommended
adding the `required` modifier on `BaseEntity` properties EF Core actually
populates, and configuring CS1591 specifically to be `noWarn` only on the
generated migration files (which can't be commented). That's the shape we
shipped. No `<NoWarn>` blanket on the projects.

**Time saved estimate:** ~45 minutes. The "weaken the setting" temptation is
real, and Claude pushed back without me having to wrestle with it.

**Lessons learned:**
- When an AI suggests weakening a strict-mode setting, it's almost always the
  wrong call. Push back and ask for the structural fix.

---

### Entry 9 — 06/05/2026

**Tool used:** Claude Sonnet 4.6 — Debugged a `RabbitMQ.Client` v7 API mismatch
in the M3.8 work where I'd written v6-style sync calls.

**Prompt / input:**
> Build error: `'IModel' does not contain a definition for 'BasicPublishAsync'`
> and `'IConnection' does not contain a definition for 'CreateChannelAsync'`.
> I'm on `RabbitMQ.Client` 7.0.0.

**Output quality:** Diagnosis was instant — v7 renamed `IModel` to `IChannel`,
made everything async, and replaced the sync `CreateModel` with
`CreateChannelAsync`. The fix was a sweep across the publisher and consumer
files. Also flagged that channels in v7 are not thread-safe and shouldn't be
shared — informed the per-publish-channel design in `RabbitMqEventPublisher`.

**Time saved estimate:** ~1 hour. Migration notes for the v6→v7 jump are
scattered across blog posts; getting the threading model right on the first
try saved a class of bugs that would have surfaced under load.

**Lessons learned:**
- When pulling in a major-version package, ask the AI for "what changed
  between v6 and v7" before you write any code against it.

---

### Entry 10 — 08/05/2026

**Tool used:** Claude Sonnet 4.6 — Diagnosed a layering violation that surfaced
when the M3.6 consumers tried to inject `IHubContext<NotificationsHub>`.

**Prompt / input:**
> The `PaymentSubmittedConsumer` (in `MyProperty.Infrastructure`) needs to
> push to SignalR. The hub is `NotificationsHub` in `MyProperty.Api`, but
> Infrastructure can't reference Api per the layering rules. What's the
> correct shape?

**Output quality:** The fix Claude proposed is the one that shipped: define
`INotificationDispatcher` in `Application/Common/Notifications/`, implement it
in `Api/Hubs/SignalRNotificationDispatcher.cs` over `IHubContext`, register the
binding from `Program.cs`. Consumers depend on the abstraction; the Hub-typed
implementation lives where Hub references are legal. Same pattern as
`IBackgroundJobQueue` (Application interface, Hangfire impl in Infrastructure).

**Time saved estimate:** ~30 minutes. Easy mistake to push through with
`InternalsVisibleTo` or by moving the hub to Infrastructure — both would have
been wrong calls.

**Lessons learned:**
- Layering violations always have the same fix: introduce an interface in the
  layer the lower layer is allowed to see, and put the implementation back
  where the dependency is legal. Worth saying out loud in the prompt.

---

### Entry 11 — 08/05/2026

**Tool used:** ChatGPT — Diagnosed a Testcontainers Docker startup failure
during integration tests.

**Prompt / input:**
> `dotnet test` is failing with
> `DockerUnavailableException: Failed to connect to Docker endpoint at
> 'npipe://./pipe/docker_engine'`. Docker Desktop reports as installed.

**Output quality:** ChatGPT identified that Docker Desktop wasn't running
(the daemon needs to be up before any Testcontainers call), suggested
launching it programmatically from PowerShell, and noted that the daemon
takes 30–60 seconds to come up before the API socket is reachable. We did
exactly that and the suite went from 22/22 failed to 22/22 passing.

**Time saved estimate:** ~10 minutes — a one-line Stack Overflow query, but
the polling-loop suggestion (`until docker version ...; do sleep 5; done`)
was a useful nicety.

**Lessons learned:**
- Testcontainers needs the Docker *daemon* up, not just Docker installed.
- A polling loop on `docker version` is a clean way to wait for the daemon
  without arbitrary `sleep` calls.

---

## Security

### Entry 12 — 30/04/2026

**Tool used:** Claude Opus 4.7 — Designed the M3.2 Keycloak auth model:
realm config, JWT validation, role transformer, default-deny authorization.

**Prompt / input:**
> Plan M3.2. Keycloak in Docker with realm import, JWT bearer validation
> against the JWKS endpoint, three roles (Tenant / Landlord / Admin) mapped
> from `realm_access.roles` into ASP.NET Core role claims, default-deny
> fallback policy on every endpoint, OAuth2 SSO via Google. Document the
> follow-ups (audience validation, fresh-tenant role assignment) so they
> don't get lost.

**Output quality:** The plan included the
`JsonWebTokenHandler.DefaultInboundClaimTypeMap.Clear()` call that's needed
to keep `sub` / `email` as their short names instead of being rewritten to
URI-style claim names — a footgun I would not have known about. The
`KeycloakRolesTransformer` design (run as `IClaimsTransformation`) was
correct on the first pass. The two follow-ups Claude flagged in the plan
(audience validation, post-acceptance role assignment for fresh tenants)
are still TODOs, but they're documented in `Program.cs` and CLAUDE.md so
they won't be missed.

**Time saved estimate:** ~4 hours. Keycloak + .NET JWT integration has many
sharp edges (claim mapping, role projection, JWKS caching, dev-vs-prod HTTPS
gate); getting them all right on the first commit saved a lot of debugging.

**Lessons learned:**
- Always ask the planner to enumerate "things that should be follow-ups, not
  blockers." Otherwise either everything blocks or things slip silently.
- The `DefaultInboundClaimTypeMap.Clear()` line is the kind of footgun you
  only learn about by getting burned. Worth pasting in any future Keycloak
  prompt as boilerplate.

---

### Entry 13 — 05/05/2026

**Tool used:** Claude Sonnet 4.6 — Audited the rate-limit policies (M3.12)
for token-enumeration risks on the anonymous invite endpoints.

**Prompt / input:**
> The anonymous endpoints `GET /invites/by-token/{token}` and
> `POST /invites/{token}/reject` distinguish 404 (unknown / non-Pending /
> expired) from 200 / 204 (valid Pending invite). Without rate limiting an
> attacker can enumerate token validity. Design a rate-limit policy that
> mitigates this without hurting legitimate users.

**Output quality:** The policy that shipped came from this prompt:
per-IP fixed window, 30 req/min on `anon-invite` paths, separate from the
`authenticated` per-user policy of 120 req/min. Claude also called out that
the partition key needs to be the IP for anonymous (sub claim doesn't exist
yet) and the sub claim for authenticated. Both are now in `Program.cs` and
called out in CLAUDE.md under Invites → Post-M3 follow-ups → security note.

**Time saved estimate:** ~1.5 hours. Rate limiting that doesn't think about
the attacker's enumeration cost is just a slow API; the threat-model framing
was the value.

**Lessons learned:**
- Frame rate-limit prompts as "prevent enumeration of X via the Y / Z
  distinction" rather than "add rate limiting" — it produces a policy with a
  clear threat model behind it.
- Anonymous + authenticated are separate partitions for a reason.

---

### Entry 14 — 08/05/2026

**Tool used:** Claude Opus 4.7 — Reviewed the SignalR JWT-from-query design
for security implications during the M3.6 work.

**Prompt / input:**
> SignalR's WebSocket handshake can't carry an Authorization header on
> browsers, so the standard pattern is to lift `?access_token=` into the
> bearer pipeline via `JwtBearerEvents.OnMessageReceived`. What are the
> attack surfaces, and how should I scope the lift to avoid them?

**Output quality:** Claude listed three concerns I wouldn't have surfaced
on my own: (1) a token in the URL gets logged by every reverse proxy and
appears in browser history — not great, but unavoidable for browsers; (2)
if the lift is unconditional, every REST endpoint accepts `?access_token=`
as a valid auth method, breaking the contract that only the header carries
auth; (3) referrer leaks across cross-origin links if a hub URL is ever
shared. Mitigations that shipped: lift restricted to `/hubs/*` paths only,
note added to `Program.cs` explaining why. Concerns 1 and 3 are inherent
to browser SignalR and are accepted residual risk for the milestone.

**Time saved estimate:** ~45 minutes. I'd have written the unconditional
lift without the path scope and called it done.

**Lessons learned:**
- Even patterns from official docs can have implicit assumptions worth
  surfacing. Asking "what are the attack surfaces" produces a different
  output than "implement this pattern."
- Document accepted residual risks in the code that creates them, not in a
  separate threat-model file that won't be read.
