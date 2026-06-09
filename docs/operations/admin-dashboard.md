# Admin / Stakeholder Dashboard — runbook

The admin portal is a single, admin-only page at **`https://app.myproperty.works/admin/dashboard`**
showing platform-wide business KPIs for a non-technical (product-lead) audience. It shares the
existing app host — no separate ingress, DNS, or Helm host. Security is the same model the
landlord/tenant portals already use: a Keycloak realm role + a backend authorization policy + a
frontend route gate.

## What it shows

Backed by `GET /api/v1/admin/dashboard` (cached server-side in Redis, 5-minute TTL):

- **Growth & users** — total users, landlords (distinct property owners), tenants (distinct
  lease holders), new users this month, and a 12-month new-users trend.
- **Adoption & occupancy** — total properties, active leases, occupancy rate (distinct
  properties with an active lease ÷ total properties), leases expiring within 30 days, new
  leases this month, and a 12-month new-leases trend.
- **Invite funnel** — sent / accepted / rejected / expired / pending, acceptance rate, and a
  12-month sent-vs-accepted trend.
- **Financial & operations** — totals **grouped by currency** (confirmed / pending / outstanding
  / overdue; never summed across currencies), payment confirmation rate, average time-to-confirm
  (hours), and a 12-month confirmed-revenue trend per currency.
- **System health** — failed-email count (this month, by `FailedAt`, plus all-time). Rendered as
  a small line, not a headline KPI.

All trend series are **gap-filled to exactly 12 month buckets** — months with no data appear as
explicit zeros so the line charts don't drop empty months.

## Security model

- **Keycloak `Admin` realm role.** The portal admin user holds **only** the `Admin` role — never
  also `Landlord`/`Tenant` (the frontend's `decodePayload` rejects a JWT carrying more than one
  portal role).
- **Backend:** the `AdminController` (`/api/v1/admin/*`) is gated by the `RequireAdmin` policy. A
  non-admin token gets a **403**. This is the real authority.
- **Frontend:** the `(admin)` route group's `KeycloakInit` bounces any non-admin session to
  `/login`; the edge middleware (`proxy.ts`) cookie-gates `/admin` like every other private path.

## Provisioning the live admin account

The Keycloak realm import only runs on first startup, so the live admin user is created via an
idempotent Helm seed-Job (`keycloak-admin-seed`, a `post-install`/`post-upgrade` hook that drives
`kcadm.sh` against the Admin API). It reads the login email + password from the
**`myproperty-admin-portal`** Secret (keys `admin-email` / `admin-password`).

> **Local dev:** the compose realm (`infrastructure/keycloak/realm-export.template.json`) seeds
> `admin@dev.local` / `admin123` with the `Admin` role for end-to-end testing.

### One-time secret setup (human-run, BEFORE the deploy)

The seed-Job runs as a `post-upgrade` hook under CD's `deploy.sh --atomic`. If the
`myproperty-admin-portal` Secret is not in the cluster when the hook runs, the hook fails and the
**entire deploy rolls back**. So this must happen **before** the PR merges to `develop` triggers CD:

```bash
# 1. Add the admin login email to the gitignored secrets env file:
#    infrastructure/gjirafa/.secrets.env
ADMIN_PORTAL_EMAIL="<admin-login-email>"

# 2. Run secrets.sh — it generates the password and applies the Secret (idempotent):
infrastructure/gjirafa/secrets.sh
```

`secrets.sh` generates and persists `ADMIN_PORTAL_PASSWORD` automatically (like the other
admin passwords). Retrieve the generated password from the cluster when you need to log in:

```bash
kubectl -n project-02 get secret myproperty-admin-portal \
  -o jsonpath='{.data.admin-password}' | base64 -d; echo
```

## Deploy & verify

Deploy is automatic via `.github/workflows/cd.yml` after merge to `develop` and approval of the
`project-02` Environment gate. After CD runs:

```bash
# Seed-Job completed and provisioned the admin user:
kubectl -n project-02 logs job/myproperty-keycloak-admin-seed
kubectl -n project-02 get job myproperty-keycloak-admin-seed   # COMPLETIONS 1/1

# The forward-only EF index migration applied (CD's --atomic rolls back workloads,
# NOT schema — verify it landed):
kubectl -n project-02 logs job/<release>-migrate | tail
```

A non-success on the seed-Job means CD's `--atomic` rolled the deploy back — check that the
`myproperty-admin-portal` Secret exists and that the NetworkPolicy allows the
`keycloak-admin-seed` pod to reach Keycloak on 8080 (`helm/myproperty/templates/security/networkpolicies.yaml`).

Then confirm login: sign in at `https://app.myproperty.works/admin/dashboard` with the admin
email + generated password; the KPI cards and trend charts should populate. A landlord/tenant
login must NOT reach `/admin`, and `GET /api/v1/admin/dashboard` with a non-admin token returns 403.

## Related

- Auth model & portals: [../portals.md](../portals.md)
- Deployment model & deferred work: [deployment-roadmap.md](deployment-roadmap.md)
- Secret provisioning: `infrastructure/gjirafa/secrets.sh`, `infrastructure/gjirafa/secrets.env.example`
