-- Idempotent seed for payments smoke test.
-- Creates: a Property owned by landlord@dev.local, and an active Lease
-- linking that property to tenant@dev.local.
--
-- Prereqs:
--   - landlord@dev.local and tenant@dev.local rows exist in users table
--     (created automatically the first time those users log in via Keycloak).
--
-- Run with:
--   docker exec -i myproperty-postgres psql -U postgres -d myproperty < scripts/seed-smoke-data.sql
--
-- Outputs a single row: the lease id to pass to smoke-payments.sh.

DO $$
DECLARE
v_landlord_id uuid;
    v_tenant_id   uuid;
    v_property_id uuid;
    v_lease_id    uuid;
BEGIN
    -- Resolve user IDs by email.
SELECT "Id" INTO v_landlord_id FROM users
WHERE LOWER("Email") = 'landlord@dev.local' LIMIT 1;
IF v_landlord_id IS NULL THEN
        RAISE EXCEPTION 'No user row for landlord@dev.local — log in via Keycloak first to trigger user sync.';
END IF;

SELECT "Id" INTO v_tenant_id FROM users
WHERE LOWER("Email") = 'tenant@dev.local' LIMIT 1;
IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No user row for tenant@dev.local — log in via Keycloak first to trigger user sync.';
END IF;

    -- Property: reuse if one already exists for this landlord with the smoke name.
SELECT "Id" INTO v_property_id FROM properties
WHERE "LandlordId" = v_landlord_id AND "Name" = 'Smoke Test Property' LIMIT 1;
IF v_property_id IS NULL THEN
        v_property_id := gen_random_uuid();
INSERT INTO properties ("Id", "LandlordId", "Name", "Address", "UnitNumber", "CreatedAt", "UpdatedAt")
VALUES (v_property_id, v_landlord_id, 'Smoke Test Property', '1 Smoke Test Street', '1A',
        NOW() AT TIME ZONE 'utc', NOW() AT TIME ZONE 'utc');
END IF;

    -- Lease: reuse the active lease for this property+tenant if one exists.
SELECT "Id" INTO v_lease_id FROM leases
WHERE "PropertyId" = v_property_id
  AND "TenantId"   = v_tenant_id
  AND "Status"     = 'Active'
  AND "DeletedAt"  IS NULL
    LIMIT 1;
IF v_lease_id IS NULL THEN
        v_lease_id := gen_random_uuid();
INSERT INTO leases (
    "Id", "LandlordId", "PropertyId", "TenantId",
    "StartDate", "EndDate", "MonthlyRent", "Currency", "Status",
    "CreatedAt", "UpdatedAt"
)
VALUES (
           v_lease_id, v_landlord_id, v_property_id, v_tenant_id,
           CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', 1200.00, 'EUR', 'Active',
           NOW() AT TIME ZONE 'utc', NOW() AT TIME ZONE 'utc'
       );
END IF;

    RAISE NOTICE 'landlord_id: %', v_landlord_id;
    RAISE NOTICE 'tenant_id:   %', v_tenant_id;
    RAISE NOTICE 'property_id: %', v_property_id;
    RAISE NOTICE 'lease_id:    %', v_lease_id;

    -- Print just the lease ID on stdout so the wrapper script can capture it.
    RAISE INFO '%', v_lease_id;
END $$;