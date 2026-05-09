-- M3.4 — Seed data for SQL optimization benchmarks.
--
-- Volumes (chosen so the planner prefers an index scan over a seq scan when
-- the right index exists, but seq-scanning is still tractable enough to
-- complete within a few hundred ms when the index is dropped — i.e. both
-- before/after timings are measurable):
--   100 landlords · 2,000 tenants · 1,000 properties (~10/landlord)
--   4,000 leases (4 per property) · 200,000 payments (50 per lease)
--   5,000 invites
--
-- Idempotent: TRUNCATEs first, so re-running gives identical sizes.
-- Run via: cat seed.sql | docker exec -i myproperty-postgres \
--           psql -U postgres -d myproperty_bench

\timing on
SET client_min_messages = WARNING;

TRUNCATE TABLE payments, leases, invites, properties, users RESTART IDENTITY CASCADE;

-- ── Users: 100 landlords + 2000 tenants ───────────────────────────────────────
INSERT INTO users (
  "Id", "KeycloakSubId", "Email", "FirstName", "LastName",
  "Phone", "AccountStatus", "CreatedAt", "UpdatedAt"
)
SELECT
  gen_random_uuid(),
  'kc-landlord-' || g::text,
  'landlord' || g::text || '@bench.local',
  'Landlord', 'Bench-' || g::text,
  NULL, 'Active', NOW(), NOW()
FROM generate_series(1, 100) g;

INSERT INTO users (
  "Id", "KeycloakSubId", "Email", "FirstName", "LastName",
  "Phone", "AccountStatus", "CreatedAt", "UpdatedAt"
)
SELECT
  gen_random_uuid(),
  'kc-tenant-' || g::text,
  'tenant' || g::text || '@bench.local',
  'Tenant', 'Bench-' || g::text,
  NULL, 'Active', NOW(), NOW()
FROM generate_series(1, 2000) g;

-- ── Properties: 10 per landlord (1,000 total) ─────────────────────────────────
INSERT INTO properties (
  "Id", "LandlordId", "Name", "Address", "UnitNumber",
  "CreatedAt", "UpdatedAt"
)
SELECT
  gen_random_uuid(),
  (SELECT "Id" FROM users WHERE "KeycloakSubId" = 'kc-landlord-' || ((g - 1) / 10 + 1)::text),
  'Property ' || g::text,
  g::text || ' Bench Street, City',
  NULL,
  NOW(), NOW()
FROM generate_series(1, 1000) g;

-- ── Leases: 4 per property (4,000 total). Tenants reused round-robin. ─────────
WITH props AS (
  SELECT "Id", row_number() OVER (ORDER BY "Id") AS rn
  FROM properties
)
INSERT INTO leases (
  "Id", "PropertyId", "TenantId",
  "StartDate", "EndDate", "MonthlyRent", "Currency", "Status",
  "CreatedAt", "UpdatedAt"
)
SELECT
  gen_random_uuid(),
  p."Id",
  (SELECT "Id" FROM users
    WHERE "KeycloakSubId" = 'kc-tenant-' || (((p.rn - 1) * 4 + s) % 2000 + 1)::text),
  DATE '2024-01-01' + ((p.rn % 365) || ' days')::interval,
  DATE '2026-12-31',
  1000 + ((p.rn * 7) % 2000)::numeric,
  'USD',
  CASE WHEN s = 4 THEN 'Ended' ELSE 'Active' END,
  NOW(), NOW()
FROM props p
CROSS JOIN generate_series(1, 4) s;

-- ── Payments: 50 per lease (200,000 total). ───────────────────────────────────
-- Status distribution: 60% Confirmed (history), 25% Outstanding (future),
-- 10% Pending (submitted, awaiting landlord), 5% Rejected.
-- DueDate distribution: spread across 50 months centered on today.
WITH ls AS (
  SELECT "Id", row_number() OVER (ORDER BY "Id") AS rn
  FROM leases
)
INSERT INTO payments (
  "Id", "LeaseId", "Amount", "Currency", "DueDate", "Status",
  "CreatedAt", "UpdatedAt"
)
SELECT
  gen_random_uuid(),
  l."Id",
  1000.00,
  'USD',
  (CURRENT_DATE - INTERVAL '25 months' + ((m - 1) || ' months')::interval)::date,
  CASE
    WHEN m <= 30 THEN 'Confirmed'                          -- 60%: paid history
    WHEN m <= 33 THEN 'Rejected'                           -- 6%: rejected
    WHEN m <= 38 THEN 'Pending'                            -- 10%: in review
    ELSE             'Outstanding'                         -- ~24%: future + overdue
  END,
  NOW(), NOW()
FROM ls l
CROSS JOIN generate_series(1, 50) m;

-- ── Invites: 5,000 with random 64-char tokens, mixed statuses. ────────────────
INSERT INTO invites (
  "Id", "LandlordId", "PropertyId",
  "Email", "FirstName", "LastName",
  "Token", "Status", "ExpiresAt",
  "ProposedStartDate", "ProposedEndDate", "ProposedMonthlyRent", "Currency",
  "CreatedAt", "UpdatedAt"
)
SELECT
  gen_random_uuid(),
  (SELECT "Id" FROM users WHERE "KeycloakSubId" = 'kc-landlord-' || ((g % 100) + 1)::text),
  (SELECT "Id" FROM properties OFFSET (g % 1000) LIMIT 1),
  'invitee' || g::text || '@bench.local',
  'Invitee', 'Bench-' || g::text,
  -- 64 hex chars — same shape as production tokens
  encode(sha256(('seed-' || g::text)::bytea), 'hex'),
  CASE g % 4
    WHEN 0 THEN 'Pending'
    WHEN 1 THEN 'Accepted'
    WHEN 2 THEN 'Rejected'
    ELSE        'Expired'
  END,
  NOW() + ((g % 30) || ' days')::interval,
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '12 months',
  1500.00,
  'USD',
  NOW(), NOW()
FROM generate_series(1, 5000) g;

-- ── ANALYZE so the planner has fresh statistics ───────────────────────────────
ANALYZE users;
ANALYZE properties;
ANALYZE leases;
ANALYZE payments;
ANALYZE invites;

-- ── Sanity check sizes ────────────────────────────────────────────────────────
SELECT 'users'      AS table_name, count(*) FROM users
UNION ALL SELECT 'properties', count(*) FROM properties
UNION ALL SELECT 'leases',     count(*) FROM leases
UNION ALL SELECT 'payments',   count(*) FROM payments
UNION ALL SELECT 'invites',    count(*) FROM invites
ORDER BY table_name;
