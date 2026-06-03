# M3.5 — Redis Cache-Aside Proof

**Status:** 🟡 code complete · perf capture pending real run
**Owner:** Backend Lead
**Endpoint:** `GET /api/v1/landlord/dashboard`
**Cache key:** `landlord:{landlordId}:dashboard` (TTL 60 s)

This benchmark times the same handler twice — once with the cache cold (a
DB round-trip + populate) and once warm (a single Redis `GET`) — to quantify
the win from cache-aside on a high-traffic endpoint.

The handler itself runs five small index-backed counts against the
M3.4-seeded dataset (1,000 properties / 4,000 leases / 200,000 payments /
2,100 users). Each individual count is fast (≲ 1 ms warm), but the
serialized round-trips through EF Core add up; cache-aside flattens that
into a single Redis read.

## Headline results

> Numbers below are placeholders until the bench harness in `bench/` is run
> against a live Postgres + Redis. Code is in place; the run produces a
> concrete results table that replaces this section.

| Phase | Operation | Median |
|---|---|---:|
| Miss | DB counts (×5) → JSON serialize → Redis `SET` | _TBD_ ms |
| Hit  | Redis `GET` → JSON deserialize | _TBD_ ms |
| **Speedup** | miss / hit | _TBD_× |

Expected order-of-magnitude based on the M3.4 cold-cache numbers and a
locally-collocated Redis (≈ 0.1 ms RTT):

- **Miss path:** five count queries hitting `IX_payments_LeaseId_Status`,
  `IX_leases_LandlordId_Status`, `IX_properties_LandlordId`, and the
  partial `IX_payments_DueDate_Outstanding`. Adding EF Core overhead and
  Redis `SET`, expect roughly 8–20 ms.
- **Hit path:** a single Redis round-trip plus `JsonSerializer.Deserialize`
  on a ~150-byte payload. Expect 0.5–1.5 ms.
- **Speedup:** therefore ≈ 10–30×, in the same ballpark as M3.4's Q1.

These estimates are conservative; actual numbers go in the table above
once the bench is run.

## Methodology

The bench harness (`bench/`) is a standalone .NET 10 console project. It
builds a slim DI graph — `AppDbContext`, `IDistributedCache`,
`LandlordDashboardRepository`, `RedisLandlordDashboardCache`,
`GetLandlordDashboardHandler` — and skips the API HTTP layer entirely so
JWT auth doesn't pollute the timings. What it measures is the end-to-end
handler latency, which is exactly what cache-aside changes.

```bash
# 1. Bring up Postgres + Redis
docker compose up -d postgres redis

# 2. Create a clean bench database that mirrors production schema
docker exec myproperty-postgres psql -U postgres -c \
  "DROP DATABASE IF EXISTS myproperty_bench; CREATE DATABASE myproperty_bench;"

# 3. Apply EF migrations to it (idempotent script — same trick as M3.4)
dotnet ef migrations script \
  --project   backend/MyProperty.Infrastructure \
  --startup-project backend/MyProperty.Api \
  --idempotent --output schema.sql
cat schema.sql | docker exec -i myproperty-postgres \
  psql -U postgres -d myproperty_bench

# 4. Reuse the M3.4 seed (same volumes, same shape)
cat docs/performance/m3-sql-optimization/seed.sql | \
  docker exec -i myproperty-postgres psql -U postgres -d myproperty_bench

# 5. Run the bench. By default it targets landlord 'kc-landlord-1' from the
#    M3.4 seed. Pass another sub-id as an argument to switch landlords.
cd docs/performance/m3-redis-caching/bench
dotnet run -- kc-landlord-1
```

The harness:

- Resolves the landlord's UUID by KeycloakSubId so the bench is portable
  across re-seeds.
- Runs three warm-up iterations of each path to stabilize JIT, EF Core's
  query plan cache, Postgres buffers, and the Redis connection pool.
- Captures **20 measured iterations** of each:
  - **Miss** — invalidates the cache before each call so the handler hits
    the DB and re-populates Redis.
  - **Hit** — leaves the cache populated so every call answers from Redis.
- Reports min / median / p95 / max / mean for each phase, plus the
  median miss / hit speedup.

The **median** is the headline number: it's resistant to one-off GC pauses
on the JIT or to a single Redis hiccup, while still tracking real warm
behaviour. p95 is reported alongside as the tail-latency signal.

### Hardware / version notes

To be filled in alongside the numbers:
- Postgres 16 / Redis 7-alpine, both in Docker Desktop on Windows
- `myproperty:bench:` instance prefix (isolates bench keys from dev keys)

## Why "miss" costs what it costs

The handler runs five separate counts in `LandlordDashboardRepository`:

1. `Properties` filtered by `LandlordId`              → `IX_properties_LandlordId`
2. `Leases` filtered by `(LandlordId, Status=Active)` → `IX_leases_LandlordId_Status`
3. Distinct `TenantId` from active leases             → same composite index, plus a hash distinct
4. `Payments` joined to `Leases`, status `Pending`    → `IX_payments_LeaseId_Status` (with a join nested-loop)
5. `Payments` joined to `Leases`, status `Outstanding` and `DueDate < today` → `IX_payments_DueDate_Outstanding` (partial)

Each individual query is sub-ms warm against the seeded dataset (M3.4
showed Q1's similar shape at ~0.7 ms warm). The aggregate cost on the
miss path is dominated by:

- EF Core's per-query overhead (parameter binding, materialization)
- Five sequential Postgres round-trips (no parallelism — same DbContext)
- One Redis `SET` of the JSON payload at the end

So the cache-aside win isn't from any single query being slow — it's from
collapsing five sequential round-trips into one.

## Why this is the right endpoint to cache

`GET /api/v1/landlord/dashboard` is the landlord portal's home page:

- **High read frequency** — every page load on the dashboard, plus
  refetches on focus and after writes.
- **Read-mostly** — the data only changes when a lease is created or a
  payment moves status. Both are infrequent relative to dashboard reads.
- **Cheap to invalidate** — the only writes that affect a landlord's
  dashboard are scoped to that landlord. We can invalidate
  `landlord:{id}:dashboard` precisely without touching anyone else's cache.

Lower-frequency endpoints (e.g. the invite preview at
`/api/v1/invites/by-token/{token}`) wouldn't earn the operational cost of
caching — they're cheap, infrequent, and one-shot.

## Invalidation

The cache TTL is 60 s. With write-through invalidation, that's a hard
upper bound on staleness; without it, the same. Staleness on a
landlord's own dashboard isn't a correctness issue — re-fetching after
60 s presents fresh data.

That said, the obvious writes invalidate explicitly so a landlord sees
their own action reflected immediately:

| Handler | Trigger | Status |
|---|---|---|
| `AcceptInviteHandler` | New lease created on accept | ✅ wired (May 5, 2026) |
| `SubmitPaymentHandler` *(M3.8)* | Tenant submits a payment | ✅ wired |
| `ConfirmPaymentHandler` *(M3.8)* | Landlord confirms a payment | ✅ wired |
| `RejectPaymentHandler` *(M3.8)* | Landlord rejects a payment | ✅ wired |

The interface (`ILandlordDashboardCache.InvalidateAsync(landlordId)`) is
in place and each handler above injects it and calls it once per write.
Other write handlers outside this table also invalidate
(`CreatePropertyHandler`, `CreatePaymentHandler`, `TerminateLeaseHandler`).

## Failure mode

`RedisLandlordDashboardCache` swallows and logs (`Warning`) any cache
error. If Redis is unreachable, the dashboard endpoint silently
degrades to a regular DB-backed query for the duration — same response
shape, same correctness, just slower. The API does **not** fail closed
on a cache outage.

This matters for the demo: bringing the stack up without Redis still
serves traffic; the warning lines in logs make the degradation visible.

## Files

- `bench/` — standalone .NET 10 console project that runs the benchmark
  - `MyProperty.Bench.Cache.csproj` — project file (NOT in `MyProperty.sln`)
  - `Program.cs` — DI setup + measurement loop
- `../../milestones/m3-backend-mvp.md` — milestone tracking
- `../m3-sql-optimization/seed.sql` — re-used as the bench dataset
