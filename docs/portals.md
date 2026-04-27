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
- Collapsible **Invitation Log** — shows `Pending`, `Rejected`, `Expired` only (not Accepted)
- Banner alert when pending invites exist — clicking scrolls to and expands the Invitation Log

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

**⚠️ Landlord has final authority over payment confirmation — tenants cannot self-confirm. Tenant UI reflects state only.**

**Payment History table**

---

## Data & Access Rules

- Tenants with any prior active lease are **never auto-deleted**. Post-lease accounts persist with **read-only access** — show as read-only, not inactive or deleted. "Read-only" means `tenantAccountStatus === 'ReadOnly'`, which is fetched from `GET /me` on each session — not derived from the JWT. The JWT carries only the portal role.
- Orphaned records (invite never opened, no lease, Keycloak account never activated) are auto-deleted after 30 days. Do not surface this to users or imply data impermanence.
- Access control is **status-based**, not role-deletion-based.

---

## Auth / Invite Flow

Three cases the invite flow must handle:
1. New user (no existing account)
2. Existing user, not logged in
3. Existing user, already logged in

Invite statuses: `Pending` · `Accepted` · `Rejected` · `Expired`

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