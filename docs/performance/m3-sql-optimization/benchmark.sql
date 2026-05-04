-- M3.4 — EXPLAIN ANALYZE benchmark for three high-traffic queries.
--
-- For each query the script:
--   1. Drops the indexes that the query depends on  → BEFORE plan
--   2. ANALYZEs (so the planner sees the new state)
--   3. Runs EXPLAIN (ANALYZE, BUFFERS) twice — second run is "warm"
--   4. Recreates the dropped indexes (matching EF/migration definitions)  → AFTER plan
--   5. Runs EXPLAIN (ANALYZE, BUFFERS) twice — second run is "warm"
--
-- The "warm" run is the headline number for the report — it removes one-shot
-- I/O variance and matches steady-state production load.
--
-- Run via: cat benchmark.sql | docker exec -i myproperty-postgres \
--           psql -U postgres -d myproperty_bench
-- Stash output: ... > results.txt 2>&1

\timing off
SET client_min_messages = WARNING;

-- Pick a fixed landlord & token & date for reproducible plans.
\set landlord_kc 'kc-landlord-42'
\set token_seed  'seed-1234'

-- ── helpers ──────────────────────────────────────────────────────────────────
\echo '════════════════════════════════════════════════════════════════════════'
\echo 'Q1: Landlord upcoming-payments — paginated, ordered by DueDate'
\echo '────────────────────────────────────────────────────────────────────────'
\echo 'Drives: GET /api/v1/landlord/upcoming-payments (LandlordDashboard)'
\echo 'Touches: properties → leases → payments (3-table join), filtered by'
\echo 'LandlordId + Status, ordered by DueDate, limit 20.'
\echo

\echo '── BEFORE: drop IX_payments_LeaseId_Status & IX_properties_LandlordId ──'
DROP INDEX IF EXISTS "IX_payments_LeaseId_Status";
DROP INDEX IF EXISTS "IX_properties_LandlordId";
ANALYZE payments; ANALYZE properties;

\echo '-- cold run --'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT pmt."Id", pmt."Amount", pmt."DueDate", pmt."Status", pmt."LeaseId"
FROM payments pmt
JOIN leases ls    ON ls."Id"   = pmt."LeaseId"
JOIN properties p ON p."Id"    = ls."PropertyId"
JOIN users u      ON u."Id"    = p."LandlordId"
WHERE u."KeycloakSubId" = :'landlord_kc'
  AND pmt."Status" IN ('Outstanding','Pending')
  AND pmt."DeletedAt" IS NULL
  AND ls."DeletedAt"  IS NULL
  AND p."DeletedAt"   IS NULL
ORDER BY pmt."DueDate" ASC
LIMIT 20;

\echo '-- warm run --'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT pmt."Id", pmt."Amount", pmt."DueDate", pmt."Status", pmt."LeaseId"
FROM payments pmt
JOIN leases ls    ON ls."Id"   = pmt."LeaseId"
JOIN properties p ON p."Id"    = ls."PropertyId"
JOIN users u      ON u."Id"    = p."LandlordId"
WHERE u."KeycloakSubId" = :'landlord_kc'
  AND pmt."Status" IN ('Outstanding','Pending')
  AND pmt."DeletedAt" IS NULL
  AND ls."DeletedAt"  IS NULL
  AND p."DeletedAt"   IS NULL
ORDER BY pmt."DueDate" ASC
LIMIT 20;

\echo '── AFTER: recreate the two indexes (matching EF migration) ──'
CREATE INDEX "IX_payments_LeaseId_Status" ON payments ("LeaseId", "Status");
CREATE INDEX "IX_properties_LandlordId"   ON properties ("LandlordId");
ANALYZE payments; ANALYZE properties;

\echo '-- cold run --'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT pmt."Id", pmt."Amount", pmt."DueDate", pmt."Status", pmt."LeaseId"
FROM payments pmt
JOIN leases ls    ON ls."Id"   = pmt."LeaseId"
JOIN properties p ON p."Id"    = ls."PropertyId"
JOIN users u      ON u."Id"    = p."LandlordId"
WHERE u."KeycloakSubId" = :'landlord_kc'
  AND pmt."Status" IN ('Outstanding','Pending')
  AND pmt."DeletedAt" IS NULL
  AND ls."DeletedAt"  IS NULL
  AND p."DeletedAt"   IS NULL
ORDER BY pmt."DueDate" ASC
LIMIT 20;

\echo '-- warm run --'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT pmt."Id", pmt."Amount", pmt."DueDate", pmt."Status", pmt."LeaseId"
FROM payments pmt
JOIN leases ls    ON ls."Id"   = pmt."LeaseId"
JOIN properties p ON p."Id"    = ls."PropertyId"
JOIN users u      ON u."Id"    = p."LandlordId"
WHERE u."KeycloakSubId" = :'landlord_kc'
  AND pmt."Status" IN ('Outstanding','Pending')
  AND pmt."DeletedAt" IS NULL
  AND ls."DeletedAt"  IS NULL
  AND p."DeletedAt"   IS NULL
ORDER BY pmt."DueDate" ASC
LIMIT 20;

\echo
\echo '════════════════════════════════════════════════════════════════════════'
\echo 'Q2: Mark Overdue Payments — recurring Hangfire job, runs daily 00:05 UTC'
\echo '────────────────────────────────────────────────────────────────────────'
\echo 'Touches: payments only. Filters by Status = Outstanding AND DueDate <'
\echo 'today. Returns IDs to update.'
\echo

\echo '── BEFORE: drop IX_payments_DueDate (Status index left in place — planner'
\echo '   bitmap-scans via "IX_payments_LeaseId_Status" filtering by Status, then'
\echo '   discards rows whose DueDate is in the future) ──'
DROP INDEX IF EXISTS "IX_payments_DueDate";
DROP INDEX IF EXISTS "IX_payments_DueDate_Outstanding";
ANALYZE payments;

\echo '-- cold run --'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT "Id"
FROM payments
WHERE "Status"    = 'Outstanding'
  AND "DueDate"   < CURRENT_DATE
  AND "DeletedAt" IS NULL;

\echo '-- warm run --'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT "Id"
FROM payments
WHERE "Status"    = 'Outstanding'
  AND "DueDate"   < CURRENT_DATE
  AND "DeletedAt" IS NULL;

\echo '── AFTER (plain): recreate IX_payments_DueDate (b-tree on full column).'
\echo '   The planner switches to an index scan on DueDate, but DueDate < today'
\echo '   matches ~74% of rows, so it ends up *slower* than the bitmap-via-Status'
\echo '   plan above. This documents that a naive (DueDate) index is the wrong'
\echo '   shape for this workload. ──'
CREATE INDEX "IX_payments_DueDate" ON payments ("DueDate");
ANALYZE payments;

\echo '-- cold run --'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT "Id"
FROM payments
WHERE "Status"    = 'Outstanding'
  AND "DueDate"   < CURRENT_DATE
  AND "DeletedAt" IS NULL;

\echo '-- warm run --'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT "Id"
FROM payments
WHERE "Status"    = 'Outstanding'
  AND "DueDate"   < CURRENT_DATE
  AND "DeletedAt" IS NULL;

\echo '── AFTER (partial): add IX_payments_DueDate_Outstanding — a partial'
\echo '   index scoped to (Status=Outstanding AND DeletedAt IS NULL). The'
\echo '   index is a fraction of the size of the full one and matches the job''s'
\echo '   filter exactly, so the planner can answer the query from the index'
\echo '   alone with no heap fetches. ──'
CREATE INDEX "IX_payments_DueDate_Outstanding" ON payments ("DueDate")
  WHERE "Status" = 'Outstanding' AND "DeletedAt" IS NULL;
ANALYZE payments;

\echo '-- cold run --'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT "Id"
FROM payments
WHERE "Status"    = 'Outstanding'
  AND "DueDate"   < CURRENT_DATE
  AND "DeletedAt" IS NULL;

\echo '-- warm run --'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT "Id"
FROM payments
WHERE "Status"    = 'Outstanding'
  AND "DueDate"   < CURRENT_DATE
  AND "DeletedAt" IS NULL;

\echo
\echo '════════════════════════════════════════════════════════════════════════'
\echo 'Q3: Invite by Token — public invite-acceptance lookup'
\echo '────────────────────────────────────────────────────────────────────────'
\echo 'Touches: invites only. Single-row read on a 64-char token.'
\echo

-- Fix a token to look up — pull one from the seed.
\set known_token `printf 'seed-1234' | sha256sum | cut -d' ' -f1`

\echo '── BEFORE: drop IX_invites_Token (unique) ──'
DROP INDEX IF EXISTS "IX_invites_Token";
ANALYZE invites;

\echo '-- cold run --'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM invites
WHERE "Token"     = :'known_token'
  AND "DeletedAt" IS NULL;

\echo '-- warm run --'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM invites
WHERE "Token"     = :'known_token'
  AND "DeletedAt" IS NULL;

\echo '── AFTER: recreate IX_invites_Token UNIQUE ──'
CREATE UNIQUE INDEX "IX_invites_Token" ON invites ("Token");
ANALYZE invites;

\echo '-- cold run --'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM invites
WHERE "Token"     = :'known_token'
  AND "DeletedAt" IS NULL;

\echo '-- warm run --'
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT *
FROM invites
WHERE "Token"     = :'known_token'
  AND "DeletedAt" IS NULL;

\echo
\echo '════════════════════════════════════════════════════════════════════════'
\echo 'Cleanup — drop the unfiltered IX_payments_DueDate so the bench DB ends'
\echo 'in a state matching production (only the partial index is kept).'
\echo '────────────────────────────────────────────────────────────────────────'
DROP INDEX IF EXISTS "IX_payments_DueDate";

\echo
\echo '════════════════════════════════════════════════════════════════════════'
\echo 'Final index state'
\echo '────────────────────────────────────────────────────────────────────────'
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('payments','leases','properties','invites')
ORDER BY tablename, indexname;
