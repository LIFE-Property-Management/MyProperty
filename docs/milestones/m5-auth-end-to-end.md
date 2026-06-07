# Milestone 5 — End-to-end Authentication & Authorization

> **Current/production auth flow:** see [../operations/auth-flow.md](../operations/auth-flow.md).
> This milestone doc is the historical local bring-up record (2026-05-29); the production
> routing / cookie gate / end-session logout were finished later in the Hetzner deploy.

**Status:** 🟡 In progress — local auth complete & verified; cluster deployment deferred
**Branch:** `feature/authorization-end-to-end`
**Aligns with:** Section 2 — Auth & Accounts

> **M5.6 — Feature flags (Unleash):** a separate M5 deliverable, documented in
> [../operations/feature-flags.md](../operations/feature-flags.md) (self-hosted
> Unleash + a receipt-OCR kill-switch) — not part of the auth work recorded here.
>
> **M5.8 — n8n automation (FS-8):** a separate M5 deliverable, documented in
> [../operations/n8n-automation.md](../operations/n8n-automation.md) (a webhook →
> Claude → Discord tenant-inquiry triage pipeline) — not part of the auth work
> recorded here.

## Goal

Close the account-creation gap. Before this milestone nobody could sign up or
log in: JWT validation, role mapping, the lazy `User` sync, and the realm import
were all wired and tested, but the **account-creation paths** and the **frontend
login** did not exist. End state:

- **Landlords** self-register on `/signup` → backend creates the Keycloak user
  with the Landlord role → user logs in.
- **Anyone** logs in via the **Keycloak hosted login page** (email/password or
  Google IdP) → redirected back to the role-appropriate portal.
- **Tenants** get accounts only through the invite flow: landlord creates an
  invite → tenant opens the emailed link → wizard (review lease → e-signature →
  set password) → backend creates the Keycloak user (Tenant role) + the `User` +
  the `Lease` and marks the invite Accepted, in one unit of work.

This document is the design + implementation record for the milestone. (The
original `auth-plan.md` working plan it was based on has been removed now that the
work is captured here.)

## What was built

### Backend
- **`IUserAccountProvisioner`** (`MyProperty.Application/Common/Interfaces/`) +
  **`KeycloakAdminClient`** (`MyProperty.Infrastructure/Keycloak/`) — typed wrapper
  over the Keycloak Admin REST three-call user-creation sequence (create user →
  reset-password → assign realm role). 409 on create → `UserAlreadyExistsException`.
  Backed by a singleton client-credentials token cache (`KeycloakAdminTokenCache`)
  and `AddStandardResilienceHandler()`.
- **Landlord registration** — `POST /api/v1/auth/register-landlord` (anonymous,
  rate-limited `anon-invite`). `RegisterLandlord{Command,Handler,Validator}` under
  `MyProperty.Application/Auth/Commands/`. Returns `{ keycloakUserId, loginUrl }`.
  The `User` row is created lazily on first authenticated call (`/me`).
- **Anonymous invite acceptance** — `POST /api/v1/invites/{token}/accept` changed
  to `[AllowAnonymous]` (the token is the auth). Rewritten `AcceptInviteHandler`
  creates the Keycloak user (Tenant role) + `User` + `Lease` and marks the invite
  Accepted in one `SaveChanges`. Rejects an email that is already a `User` (409).
- **`UserAlreadyExistsException` → 409** in `GlobalExceptionHandler`.
- **Realm** (`infrastructure/keycloak/realm-export.template.json`) — service
  accounts enabled on `myproperty-api` with `realm-management` roles
  (`manage-users`, `view-users`, `view-realm`); Direct Access Grant disabled on
  `myproperty-frontend` (hosted-login only). `verify-realm-import.sh` + a CI job
  assert the service account works after import.

### Frontend
- **`/login`** is now a single "Continue to sign-in" button that calls
  `keycloak.login()` (hosted login); the old email/password form, `useLoginMutation`,
  and `login` schema were deleted. Shows an "account created" banner on `?registered=1`.
- **`/signup`** keeps the form; `useSignupMutation` POSTs to `register-landlord`,
  then redirects to `/login?registered=1`.
- **`keycloak.ts`** uses `onLoad: "check-sso"` (+ `public/silent-check-sso.html`)
  and exports `login()` / `logout()`.
- **Invite wizard** collects `firstName`/`lastName`/`password`; `useAcceptInvite`
  POSTs the new body shape and redirects to `/login` on success.
- **`proxy.ts`** middleware: `/login`, `/signup`, `/logout` are public; unauthenticated
  users are sent to `/login?redirectTo=…`.

> The bulk of the above landed in an earlier session. **This session** diagnosed
> and fixed the issues that stopped it from actually running locally, and verified
> the whole flow end-to-end (below).

## Bugs found & fixed bringing it up locally (2026-05-29)

| # | Symptom | Root cause | Fix |
|---|---|---|---|
| 1 | Realm redirect URIs were `https://app.myproperty.localhost/*`; frontend bundle called `https://api.myproperty.localhost` | Local `.env` had been filled with the `.env.proxy.example` HTTPS values, which require the `infrastructure/nginx` reverse proxy that the default stack does not run | Reverted the three public URLs in `.env` to plain localhost (`http://localhost:8080/3000/5042`), matching `.env.example` |
| 2 | Every real login rejected at the API: `error_description="The issuer 'http://localhost:8080/realms/MyProperty' is invalid"` | The Authority/MetadataAddress split means .NET derives the valid issuer from the discovery doc fetched via MetadataAddress (`keycloak:8080`), but browser tokens carry `iss=localhost:8080`. `Program.cs` never set `ValidIssuer` | Added `ValidIssuer = keycloakAuthority` to `TokenValidationParameters` in `Program.cs` (the documented intent; works in dev and prod) |
| 3 | "Continue to sign-in" button threw `can't access property "login", this[#adapter] is undefined` | `login()` called keycloak-js `kc.login()` before `init()`; the `/login` route is not under a portal layout that calls `initKeycloak`, so the adapter was never set up | `login()` now `await initKeycloak()` (idempotent) before redirecting — `frontend/lib/auth/keycloak.ts` |

Operational note (not a code bug): `docker compose down -v` wipes Postgres and the
API does **not** auto-migrate, so EF migrations must be re-applied manually:
`ASPNETCORE_ENVIRONMENT=Development dotnet ef database update -p MyProperty.Infrastructure -s MyProperty.Api`.
See `docs/operations/migrations.md`.

## Verification (local `docker compose`, 2026-05-29)

Tokens for the headless checks were minted via the real hosted-login
Authorization-Code + PKCE flow against `myproperty-frontend` (no Direct Access
Grant required), proving the production login path.

- **Phase 1 — realm/service account:** `verify-realm-import.sh` → service account
  carries `manage-users`, `view-users`, `view-realm`. Password grant to
  `myproperty-frontend` → `unauthorized_client` (DAG correctly off).
- **Phase 3 — landlord:** register `201`; duplicate `409` (RFC 7807); weak password
  `400` with `errors.Password`. Hosted login → `GET /api/v1/me` **200**, `User` row
  lazily created with the `Landlord` role.
- **Phase 4 — invite/tenant:** landlord creates property + invite; token extracted
  from MailHog; **anonymous** accept → `200 {inviteId, leaseId}`. Verified: Keycloak
  tenant has `Tenant` role; DB has `User` (Active) + `Lease` (Active, 750 EUR); invite
  `Accepted`. Tenant hosted login → `GET /api/v1/me/lease` **200**. Re-accept same
  token → **404**; accept with an already-registered email → **409**.
- **Phase 5 — frontend (real browser, Playwright, bypass off):** `/login` →
  Keycloak hosted page → back to `localhost:3000` with an auth code → `/dashboard`
  does not bounce to `/login`; both the Keycloak SSO session and the app `kc_token`
  cookie are present.
- **Regression:** backend `dotnet test` **125** (90 unit + 35 integration) green;
  frontend `npm test` **385** green; `tsc --noEmit` clean.

## Deferred / out of scope

- **Cluster deployment.** The original DOKS + Name.com deployment plan (M4.7) is
  abandoned. The new target is a shared Hetzner cluster where we have a
  **namespaced** ServiceAccount only (`project-02`) — no cluster-scoped access, no
  managed Postgres. The Helm chart / Terraform need rework for a fully namespaced
  deploy. Tracked for a separate session.
- **Verify the invitee actually controls the invited mailbox.** Invite acceptance
  is anonymous and the new account is bound to `invite.Email` — the acceptor cannot
  supply a different address (`AcceptInviteCommand` has no email field; the handler
  uses `invite.Email` for the duplicate check, Keycloak provisioning, and the `User`
  row). So the account is always created under the *intended* email. **However**, we
  never prove the person clicking the link controls that inbox: the Keycloak user is
  created with `emailVerified = false` (`KeycloakAdminClient.cs`), and possession of
  the emailed token is the only proxy for ownership — the same trust model as a
  password-reset link, so a forwarded/intercepted invite link could be completed by
  someone else. **To close this later:** require Keycloak email verification after
  accept, or only set `emailVerified = true` once a post-accept verification step
  completes. Lever: the `emailVerified` flag in `KeycloakAdminClient` + an optional
  verification email. Low risk for the current model; worth doing before any
  sensitive tenant action depends on a proven email.
- **Tenant read-only enforcement** (no active lease → ReadOnly). Data model + UI
  exist; missing the Hangfire flag job + authorization handler.
- **Forgot password** (enable `resetPasswordAllowed` on the realm when wanted).
- **Existing-user accepts invite** (account exists): currently rejected with a clear
  409; full UX is a follow-up.
- **Invite audit fields** (`AcceptedByUserId`, `ResultingLeaseId`).

## Local dev quick reference

1. `.env` uses the plain-localhost profile (not `.env.proxy.example`).
2. `docker compose up -d --build` (rebuilds backend+frontend, re-imports realm).
3. After any `down -v`: re-apply EF migrations (command above).
4. Real frontend auth: run the frontend with `NEXT_PUBLIC_DEV_AUTH_BYPASS=false`
   and `NEXT_PUBLIC_API_BASE_URL=http://localhost:5042` on **port 3000** (realm
   redirect URIs only allow `http://localhost:3000/*`). MailHog UI: `http://localhost:8025`.
