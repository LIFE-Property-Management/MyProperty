# M6.2 — North Star Metric

| | |
|---|---|
| **Deliverable** | M6.2 — North Star Metric |
| **Status** | ✅ Defined · ✅ Defended · ✅ Being tracked |
| **Owner** | Product |
| **Date** | 2026-06-07 |

---

## The Metric

> **Active Leases Under Management**
>
> The number of leases with `Status = Active` and `DeletedAt IS NULL` across the entire platform at any point in time.

**Formula:**
```sql
SELECT COUNT(*) FROM leases
WHERE "Status" = 'Active' AND "DeletedAt" IS NULL;
```

**Current value:** visible on the landlord dashboard (`activeLeases` stat card) and in Prometheus (`myproperty_active_leases_total` gauge updated every 60 s).

---

## Why This Metric

### The argument

MyProperty's core promise is: *a landlord can manage their rental properties and tenants in one place*. That promise is only fulfilled when a landlord has at least one active tenant paying rent through the platform. An **active lease** is the smallest unit of real, delivered value:

- It means a landlord signed up **and** invited a tenant.
- It means a tenant accepted the invite **and** created an account.
- It means both parties are actively using the platform.
- It means rent payments flow through MyProperty.

Every other metric is either upstream (signups, invites sent) or downstream (revenue) of this moment. Active leases are the **leading indicator** that the platform is delivering on its promise today, not just attracting interest.

### One active lease requires the full product to work

```
Landlord signs up
    → Creates a property
        → Sends an invite
            → Tenant accepts (Keycloak account created)
                → Lease row created in DB
                    → Active Lease ✅
```

If any step in this chain is broken, the count does not grow. The metric therefore acts as an end-to-end health check of the entire user journey.

---

## Why NOT the alternatives

| Candidate metric | Why rejected |
|---|---|
| **Total landlord signups** | Vanity metric. A landlord with zero tenants gets no value from the platform. |
| **Invites sent** | Activity, not outcome. An invite that is never accepted produces no value. |
| **Monthly rent collected** | Lagging indicator — rent is collected 30 days after the lease starts. Slow feedback loop. |
| **Total users (landlords + tenants)** | Mixes two groups with completely different engagement patterns. Difficult to act on. |
| **Daily active users (DAU)** | Property management is low-frequency by nature (monthly rent cycle). DAU would always look low and mislead. |
| **Revenue / MRR** | Useful for finance, but lags behind product decisions by weeks. Also suppressed in early growth when landlords are onboarding free. |

---

## How It Is Tracked

### 1. Per-landlord view — dashboard (real-time)

Every landlord dashboard load calls `GET /api/v1/landlord/dashboard`. The response includes:

```json
{
  "activeLeases": 3,
  "totalProperties": 5,
  "activeTenants": 3,
  "pendingPayments": 1,
  "overduePayments": 0,
  "generatedAt": "2026-06-07T00:00:00Z"
}
```

The `activeLeases` field is rendered as a stat card on `app.myproperty.works/dashboard`, visible to every landlord on every page load.

**Source:** `LandlordDashboardRepository.GetForLandlordAsync()`:
```csharp
var activeLeases = await db.Leases
    .CountAsync(l => l.LandlordId == landlordId && l.Status == LeaseStatus.Active, ct);
```

### 2. Platform-wide view — Prometheus gauge

`NorthStarMetricWorker` is a `BackgroundService` registered in `Program.cs`. It runs in the API process and queries the DB every 60 seconds:

```csharp
var count = await db.Leases
    .CountAsync(l => l.Status == LeaseStatus.Active, stoppingToken);
ActiveLeasesGauge.Set(count);
```

The gauge `myproperty_active_leases_total` is exposed on the `/metrics` endpoint (prometheus-net.AspNetCore). Prometheus scrapes it every 15 s.

**Verified locally:**
```
# HELP myproperty_active_leases_total Total active leases across the entire platform (North Star Metric).
# TYPE myproperty_active_leases_total gauge
myproperty_active_leases_total 0
```

Worker log output:
```
NSM updated: myproperty_active_leases_total = 0
```

### 3. Database — source of truth

```sql
-- Run at any time to get the canonical count
SELECT COUNT(*) AS active_leases
FROM leases
WHERE "Status" = 'Active' AND "DeletedAt" IS NULL;
```

---

## Target & Growth Signal

| Signal | Meaning |
|---|---|
| `active_leases` grows week-over-week | Landlords are successfully inviting and retaining tenants |
| `active_leases` flat despite new signups | Invite funnel is broken — tenants are not accepting |
| `active_leases` drops | Leases are being terminated without new ones replacing them |

**Initial target (M6 window):** ≥ 1 active lease on the production cluster, demonstrating the full end-to-end flow works.

---

## Evidence

| Check | Status |
|---|---|
| `activeLeases` stat card on landlord dashboard | ✅ Live — `LandlordDashboardDto.ActiveLeases` |
| `myproperty_active_leases_total` Prometheus gauge | ✅ Verified — `curl localhost:5042/metrics \| grep active_leases` |
| `NorthStarMetricWorker` logs on startup | ✅ `NSM updated: myproperty_active_leases_total = 0` |
| DB query returns correct count | ✅ `COUNT(leases WHERE Status='Active' AND DeletedAt IS NULL)` |
