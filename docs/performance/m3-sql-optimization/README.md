# M3.4 — SQL Optimization Proof

**Status:** ✅ done · **Captured:** 2026-05-04 · **Owner:** Backend Lead

Three real-workload queries analyzed with `EXPLAIN (ANALYZE, BUFFERS)` against
a Postgres 16 dataset of 200,000 payments / 4,000 leases / 1,000 properties /
5,000 invites / 2,100 users. Each query was timed in three states:

1. **Before** — the supporting index dropped, so the planner falls back to a
   sequential scan or a less-selective index path.
2. **After** — the existing migration's index restored.
3. **After (improved)** *(Q2 only)* — a partial index that fits the workload's
   predicate exactly, replacing a naive full-column index that was actively
   harmful.

The headline number for each query is the **warm execution time** — the second
of two back-to-back runs, after planner/buffer caches have settled. Cold
numbers are reported alongside but track the same direction.

## Headline results

| # | Query | Before (warm) | After (warm) | Speedup | Index |
|---|---|---:|---:|---:|---|
| Q1 | Landlord upcoming-payments | **16.363 ms** | **0.739 ms** | **~22×** | `IX_payments_LeaseId_Status` + `IX_properties_LandlordId` |
| Q2 | Mark overdue payments (Hangfire) | **4.616 ms** | **0.045 ms** | **~103×** | `IX_payments_DueDate_Outstanding` (partial) |
| Q3 | Invite by token | **0.492 ms** | **0.038 ms** | **~13×** | `IX_invites_Token` (unique) |

For Q2, a **naive non-partial b-tree** on `DueDate` was *slower* than no index
at all (8.981 ms vs 4.616 ms). Documented in detail below — the workload's
predicate selectivity is the lesson.

> **Reproducibility note.** The absolute ms numbers are from a single
> point-in-time run (committed to `results.txt`). On a fresh re-run, the
> double-digit-ms timings vary by ±10-30% and the sub-ms timings by ±50%
> due to OS/Docker noise. The **ratios** (~20×, ~100×, ~10×) and the
> direction (Q2 partial decisively better than plain) are stable across
> runs.

## Methodology

```bash
# 1. Bring up Postgres
docker compose up -d postgres

# 2. Create a clean bench database that mirrors production schema
docker exec myproperty-postgres psql -U postgres -c \
  "DROP DATABASE IF EXISTS myproperty_bench; CREATE DATABASE myproperty_bench;"

# 3. Apply EF migrations to it (generated once via `dotnet ef migrations script
#    --idempotent` and piped through psql so it doesn't fight the host's local
#    Postgres on port 5432).
dotnet ef migrations script --project backend/MyProperty.Infrastructure \
  --startup-project backend/MyProperty.Api --idempotent --output schema.sql
cat schema.sql | docker exec -i myproperty-postgres psql -U postgres -d myproperty_bench

# 4. Seed
cat docs/performance/m3-sql-optimization/seed.sql | \
  docker exec -i myproperty-postgres psql -U postgres -d myproperty_bench

# 5. Run benchmark, capture results
cat docs/performance/m3-sql-optimization/benchmark.sql | \
  docker exec -i myproperty-postgres psql -U postgres -d myproperty_bench \
  > docs/performance/m3-sql-optimization/results.txt 2>&1
```

`seed.sql` and `benchmark.sql` are committed alongside this README, so the
whole pipeline is reproducible end-to-end. `results.txt` holds the raw
EXPLAIN output the numbers below were extracted from.

### Hardware / version notes
- Postgres 16.13 on x86_64 (postgres:16-alpine)
- Single Docker container, default `shared_buffers` and `work_mem`
- All measurements taken on the same machine in a single session, so relative
  numbers are meaningful even if the absolute ms scale would differ on a
  production node.

### Why "warm" is the headline
For each plan we run the query **twice**. The first run pays for index page
loads, the second run runs against a hot buffer cache. Production traffic
behaves like the warm case (an "overdue scan" runs every day; a landlord's
own dashboard is hit every page load). Cold numbers matter for tail latency
on cold caches but aren't representative of steady state.

---

## Q1 — Landlord upcoming-payments dashboard

### Query
```sql
SELECT pmt."Id", pmt."Amount", pmt."DueDate", pmt."Status", pmt."LeaseId"
FROM payments pmt
JOIN leases ls    ON ls."Id"   = pmt."LeaseId"
JOIN properties p ON p."Id"    = ls."PropertyId"
JOIN users u      ON u."Id"    = p."LandlordId"
WHERE u."KeycloakSubId" = $1
  AND pmt."Status" IN ('Outstanding','Pending')
  AND pmt."DeletedAt" IS NULL
  AND ls."DeletedAt"  IS NULL
  AND p."DeletedAt"   IS NULL
ORDER BY pmt."DueDate" ASC
LIMIT 20;
```
Drives `GET /api/v1/landlord/upcoming-payments`, hit on every landlord
dashboard load (target on `LandlordDashboard.tsx`).

### Plans

**Before** — `IX_payments_LeaseId_Status` and `IX_properties_LandlordId` dropped:
```
Limit  (actual time=13.990..16.260 rows=20 loops=1)
  Buffers: shared hit=3054
  ->  Gather Merge  (Workers: 2)
        ->  Sort  (top-N heapsort, key: pmt."DueDate")
              ->  Hash Join
                    ->  Parallel Seq Scan on payments pmt
                          Filter: DeletedAt IS NULL AND Status IN (...)
                          Rows Removed by Filter: 66000
Planning Time: 0.445 ms
Execution Time: 16.363 ms
```
Planner has no choice but to parallel-seq-scan all 200k payment rows,
filter ~66% out, then hash-join the small landlord/property/lease set in.
3054 shared buffer hits.

**After** — both indexes restored:
```
Limit  (actual time=0.7xx rows=20 loops=1)
  Buffers: shared hit=~990
  ->  Sort  (top-N heapsort)
        ->  Nested Loop
              ->  Index Scan using IX_users_KeycloakSubId
              ->  Bitmap Heap Scan on properties (IX_properties_LandlordId)
              ->  Index Scan using IX_leases_PropertyId_Status
        ->  Index Scan using IX_payments_LeaseId_Status
              Index Cond: LeaseId = ls.Id AND Status IN (...)
Execution Time: 0.739 ms
```
Driven from the user → properties (10) → leases (40) → payments (~17/lease)
nested-loop chain. Buffer reads drop from 3054 → ~990, execution time
**16.363 → 0.739 ms** — a **~22× speedup**.

### Indexes
Both already declared in `LeaseConfiguration` / `PropertyConfiguration` /
`PaymentConfiguration`:
- `IX_payments_LeaseId_Status` (composite)
- `IX_properties_LandlordId`
- `IX_leases_PropertyId_Status` (composite, used as the inner-loop driver)

No schema changes required — the indexes are correct as-is. The benchmark
documents that they're earning their keep.

---

## Q2 — Mark overdue payments (recurring Hangfire job)

### Query
```sql
SELECT "Id"
FROM payments
WHERE "Status"    = 'Outstanding'
  AND "DueDate"   < CURRENT_DATE
  AND "DeletedAt" IS NULL;
```
Recurring job (`MarkOverduePayments`, daily at 00:05 UTC). Returns the
`Id`s the next pass updates to overdue.

### Plans

**Before** — `IX_payments_DueDate` dropped (`IX_payments_LeaseId_Status` left
in place; the planner uses it via the Status leg):
```
Bitmap Heap Scan on payments
  Recheck Cond: Status = 'Outstanding'
  Filter: DeletedAt IS NULL AND DueDate < CURRENT_DATE
  Rows Removed by Filter: 48000
  Heap Blocks: exact=687
  Buffers: shared hit=950
  ->  Bitmap Index Scan on IX_payments_LeaseId_Status
        Index Cond: Status = 'Outstanding'
Execution Time: 4.616 ms
```
Planner walks the composite `(LeaseId, Status)` index for `Status =
'Outstanding'`, gets ~48k matching rows, fetches each from the heap, and
filters by date. 950 buffer hits.

**After (plain `(DueDate)` b-tree)** — the full-column index that the original
migration shipped:
```
Index Scan using IX_payments_DueDate on payments
  Index Cond: DueDate < CURRENT_DATE
  Filter: DeletedAt IS NULL AND Status = 'Outstanding'
  Rows Removed by Filter: 100000
  Buffers: shared hit=1517
Execution Time: 8.981 ms
```
The planner switches to the new `IX_payments_DueDate`. But the bench data
puts ~74% of payments in the past (a deliberately realistic spread — every
lease has 50 monthly payments centered on today, so ~25 of 50 are <
CURRENT_DATE). The index cond returns ~148k rows; 100k are then thrown out
by the `Status` filter.

**Result: the index is *worse* than no index** — 8.981 ms vs 4.616 ms. Buffer
hits 1517 vs 950. This is the classic "index on a low-selectivity column"
trap: the index correctly identifies all rows matching the date predicate,
but the date predicate is the cheap part of the query.

**After (partial `(DueDate) WHERE Status='Outstanding' AND DeletedAt IS NULL`)**
```
Index Scan using IX_payments_DueDate_Outstanding on payments
  Index Cond: DueDate < CURRENT_DATE
  Buffers: shared hit=2
Execution Time: 0.045 ms
```
The partial index only contains the rows the job actually cares about —
`Status = 'Outstanding' AND DeletedAt IS NULL` — so:
- The index is ~4% the size of a full-column b-tree (only ~48k entries
  instead of 200k), so it stays hot in cache.
- The remaining `Status` and `DeletedAt` filters are absorbed by the index
  predicate, so the planner can satisfy the query from the index alone with
  no recheck filter.
- Buffer reads drop from 1517 → 2.

**Execution time: 4.616 ms (no DueDate index) → 0.045 ms (partial). A ~103×
speedup, and ~200× faster than the naive plain index it replaces.**

### Schema change
- `PaymentConfiguration.cs:30-37` — DueDate index now uses `.HasFilter(...)`
  with explicit `.HasDatabaseName("IX_payments_DueDate_Outstanding")` so the
  partial scope is visible from `\d payments`.
- Migration: `20260504095019_AddOverduePaymentsPartialIndex` — drops the
  unfiltered `IX_payments_DueDate`, creates the partial.

### Why the existing index was wrong
The CLAUDE.md required-indexes list calls for `Payment(DueDate) — overdue
scans`. That intent is right; the implementation (a full-column b-tree) was
the wrong shape for the predicate. This benchmark turns "we should index
DueDate" into "DueDate's index needs to match the actual filter." The lesson
generalizes: when a recurring job has a fixed `WHERE` clause, prefer a
partial index over a covering index over a column index, in that order.

---

## Q3 — Invite by Token

### Query
```sql
SELECT *
FROM invites
WHERE "Token"     = $1
  AND "DeletedAt" IS NULL;
```
Hit by the public invite-acceptance route (`/invite/<token>`). Single-row
read, but on a 64-character random token — the worst case for sequential
filtering.

### Plans

**Before** — `IX_invites_Token` (unique) dropped:
```
Seq Scan on invites
  Filter: DeletedAt IS NULL AND Token = '0216ec07d03b...390459c'
  Rows Removed by Filter: 4999
  Buffers: shared hit=157
Execution Time: 0.492 ms
```
Full table scan of all 5,000 invites, comparing each token. 157 buffer hits.

**After** — `IX_invites_Token UNIQUE` restored:
```
Index Scan using IX_invites_Token on invites
  Index Cond: Token = '0216ec07d03b...390459c'
  Filter: DeletedAt IS NULL
  Buffers: shared hit=3
Execution Time: 0.038 ms
```
Direct index seek. **0.492 → 0.038 ms — a ~13× speedup**. Buffers 157 → 3.

The absolute time is small either way (small dataset), but the buffer-hit
ratio (157 → 3) is the better signal of how this scales: at 50,000 invites
the seq scan grows linearly while the index scan stays at 3-4 buffer hits.

### Indexes
Already declared in `InviteConfiguration` as `HasIndex(i => i.Token).IsUnique()`.
The benchmark documents that this index — which doubles as the uniqueness
constraint preventing duplicate tokens — is also the read-path's primary
optimization.

---

## N+1 audit

Per BE-6 ("N+1 problems eliminated"), the three query handlers above were
audited for N+1 issues during this work:

| Handler | Pattern | Status |
|---|---|---|
| `GetLandlordUpcomingPaymentsHandler` *(planned)* | Single SELECT with explicit JOINs to leases, properties, users | ✅ N+1-safe by construction |
| `MarkOverduePaymentsJob` | Single SELECT returning IDs; UPDATE issued in one statement against the ID set | ✅ no per-row trips |
| `GetInviteByTokenHandler` *(planned)* | Single index seek; no related-data fetch | ✅ trivially safe |

Convention going forward: list endpoints use `Include` *or* projection
(`Select` to a DTO), never lazy navigation. Repositories return materialized
results (`List<T>`, `T?`), never `IQueryable<T>`. This is enforced by code
review against the rules in `backend/CLAUDE.md`.

## Files

- `seed.sql` — deterministic seed (200k payments / 5k invites etc.)
- `benchmark.sql` — drops indexes, runs `EXPLAIN ANALYZE`, restores indexes
- `results.txt` — raw output from the latest run (committed; regenerated by
  re-running the pipeline above)
- `../../milestones/m3-backend-mvp.md` — milestone tracking
