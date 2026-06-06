# M6.2 — North Star Metric

| | |
|---|---|
| **Deliverable** | M6.2 — North Star Metric |
| **Status** | ✅ Defined · ✅ Defended · ✅ Being tracked |
| **Owner** | Product |
| **Date** | 2026-06-05 |

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

**Current value:** visible on the landlord dashboard (`activeLeases` field) and in Grafana (`grafana.myproperty.works`).

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

### 1. Per-landlord view (real-time)

The landlord dashboard calls `GET /api/v1/landlord/dashboard` on every load. The response includes:

```json
{
  "activeLeases": 3,
  ...
}
```

This is rendered as a stat card ("Active leases") visible to every landlord on their dashboard.

**Source:** `LandlordDashboardRepository.GetForLandlordAsync()` — queries `db.Leases` with `Status = Active` filter.

### 2. Platform-wide view (Prometheus + Grafana)

The backend exposes a `/metrics` endpoint (prometheus-net.AspNetCore). A custom gauge `myproperty_active_leases_total` is updated on every dashboard cache refresh (60 s TTL), giving a platform-wide total.

Grafana at `grafana.myproperty.works` has a dedicated panel in the **MyProperty API Metrics** dashboard showing:
- Current value (stat panel)
- 30-day trend (time-series panel)

### 3. Database source of truth

```sql
-- Run at any time to get the canonical value
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

- ✅ Dashboard stat card live at `app.myproperty.works/dashboard` — shows `activeLeases` per landlord in real time.
- ✅ Backend DTO: `LandlordDashboardDto.ActiveLeases` — field present in production since M6 deploy.
- ✅ Prometheus metric `myproperty_active_leases_total` — scraped every 15 s by in-cluster Prometheus.
- ✅ Grafana panel — visible at `grafana.myproperty.works` under the API Metrics dashboard.
- ✅ DB query verified on `project-02` cluster via `kubectl exec`.
