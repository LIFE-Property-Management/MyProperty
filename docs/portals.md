# MyProperty — Portal Specs

## Landlord Portal

### Dashboard (`/dashboard`)
**Stat cards:** Total Properties, Total Active Tenants

**Action tables (require attention):**
- Overdue Payments
- Leases Expiring Soon (threshold: 30 days)

**Summary tables:**
- Recent Payments (last 5)
- Upcoming Payments (next 30 days, paginated)

### Tenants Page
- Tenant List table

### Invites Page (`/dashboard/invites`)
- Dedicated invite-management page (replaces the Tenants-page "Invitation Log"). Lists the landlord's
  invites with status (`Pending`/`Accepted`/`Rejected`/`Expired`/`Revoked`), filterable by status.
- **Revoke** a `Pending`/`Expired` invite (→ `Revoked`) and **resend** one (fresh token, expiry reset,
  email re-sent). Backed by `GET /api/v1/invites`, `POST /api/v1/invites/{id}/revoke`,
  `POST /api/v1/invites/{id}/resend`.

### Tenant Detail Page
- Tenant summary card
- Last payment date stat
- Payment History table (filterable)

---

## Tenant Portal

### Dashboard
**Lease Summary card**

**Payment Section — four states:**
| State | Meaning |
|---|---|
| `Outstanding` | Payment is due |
| `Pending` | Tenant submitted proof, awaiting landlord confirmation |
| `Confirmed` | Landlord confirmed payment |
| `Rejected` | Landlord rejected the submission |

**Payment submission methods:**
- Receipt upload (digital payment)
- Manual request (cash payment)

> **M3 status (May 2026):** the payment submit endpoint
> (`POST /api/v1/payments/{id}/submit`) currently accepts `application/json`
> only. The receipt file itself is not yet uploaded — `Method = ReceiptUpload`
> submissions persist with `ReceiptFileKey`/`ReceiptFileName` as null. File
> upload (multipart/form-data, validation, storage) lands in M3.9. The tenant
> frontend can build the file picker UX against the eventual shape; the wire
> format is JSON-only until M3.9 ships.

**⚠️ Landlord has final authority over payment confirmation — tenants cannot self-confirm. Tenant UI reflects state only.**

**Payment History table**

---

## Admin Portal

### Stakeholder Dashboard (`/admin/dashboard`)
Admin-only, single page of platform-wide business KPIs for a non-technical (product-lead)
audience. Shares the app host; gated by the Keycloak `Admin` role + the backend `RequireAdmin`
policy + the `(admin)` route gate. The admin user holds **only** the `Admin` portal role.

**Sections (KPI cards + recharts trends):**
- **Growth & users** — total users, landlords, tenants, new users this month + 12-month trend.
- **Adoption & occupancy** — properties, active leases, occupancy rate, leases expiring ≤30 days,
  new leases this month + 12-month trend.
- **Invite funnel** — sent / accepted / rejected / expired / pending, acceptance rate + 12-month
  sent-vs-accepted trend.
- **Financial & operations** — totals **per currency** (confirmed / pending / outstanding /
  overdue, never summed across currencies), confirmation rate, avg time-to-confirm + 12-month
  confirmed-revenue trend per currency.
- **System health** — failed-email count (small line, not a headline KPI).

Backed by `GET /api/v1/admin/dashboard` (cached, Redis, 5-min TTL). Operational details:
[operations/admin-dashboard.md](operations/admin-dashboard.md).

---

## Data & Access Rules

- Tenants with any prior active lease are **never auto-deleted**. Post-lease accounts persist with **read-only access** — show as read-only, not inactive or deleted. "Read-only" means `tenantAccountStatus === 'ReadOnly'`, which is fetched from `GET /me` on each session — not derived from the JWT. The JWT carries only the portal role.
- Orphaned records (invite never opened, no lease, Keycloak account never activated) are auto-deleted after 30 days. Do not surface this to users or imply data impermanence.
- Access control is **status-based**, not role-deletion-based.

---

## Auth / Invite Flow

Three cases the invite flow must handle:
1. New user (no existing account) → anonymous `POST /invites/{token}/accept` provisions a Keycloak
   account + `User` row and creates the lease.
2. Existing user, not logged in → the accept page detects the existing account (the anonymous accept
   returns `409` with "Please log in instead.") and routes them to sign in, then case 3.
3. Existing user, already logged in → authenticated `POST /invites/{token}/claim` reuses the account
   (no Keycloak provisioning); the JWT email must match the invite email (else `403`). **Implemented**
   (returning-tenant accept).

Invite statuses: `Pending` · `Accepted` · `Rejected` · `Expired` · `Revoked` (landlord-cancelled,
distinct from a naturally `Expired` invite).

**Preview is status-aware.** `GET /invites/by-token/{token}` returns `200` with a `status` field for
any *resolved* invite (so the accept page can show a specific Accepted/Rejected/Expired view); `404`
is returned only for a **truly unknown** token (the token is a secret bearer — we don't confirm
existence). A `Pending` invite past its `ExpiresAt` is reported as `Expired`.

**Lease acceptance screen comes before account creation or password setup.**

**Auth model:** Auth state lives in a shared `useAuthStore` (Zustand). Each user has exactly one
portal role (`tenant`, `landlord`, or `admin`), derived from `realm_access.roles[]` in the JWT.
Role-specific domain state (e.g. `tenantAccountStatus`) is fetched from `GET /me` — not stored
in the JWT. Tenants who call `GET /me` when `portal !== 'tenant'` receive no data (query is disabled).

---

## What the Backend Handles (do not reimplement)
- Authentication & session management → Keycloak
- Invite email sending & token validation → .NET backend
- Scheduled jobs (orphan cleanup, expiry checks) → Hangfire
- Payment confirmation authority → backend only
- Tenant account status (`GET /me` → `tenantAccountStatus`) → backend only; frontend reads via `useMe()` hook