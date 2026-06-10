# Frontend Auth Flow (production)

How the Next.js frontend authenticates against Keycloak in the deployed environment, and
why each piece exists. This is the current/production reference; the historical bring-up
notes live in [`../milestones/m5-auth-end-to-end.md`](../milestones/m5-auth-end-to-end.md).

Keycloak is the IdP (realm `MyProperty`, public client `myproperty-frontend`, standard
flow + PKCE S256). The frontend uses **keycloak-js** with `onLoad: "check-sso"`. The real
access token lives **in keycloak-js memory** and is sent to the API as
`Authorization: Bearer <token>`; it is never persisted to a cookie or localStorage.

Key files:
- `frontend/lib/auth/keycloak.ts` — keycloak-js wrapper: `login`, `initKeycloak`, `logout`,
  token accessors, and the gate-cookie helpers.
- `frontend/proxy.ts` — Next.js middleware: the coarse edge gate on protected routes.
- `frontend/app/(auth)/login/page.tsx` — the post-login landing + role router.
- `frontend/app/dashboard/_components/KeycloakInit.tsx` and
  `frontend/app/(tenant)/_components/KeycloakInit.tsx` — the authoritative per-portal gate.
- `frontend/lib/hooks/useAuth.ts` — `signOut()`.
- `frontend/lib/store/auth/useAuthStore.ts` — the Zustand auth store (`user` = decoded portal/role).

---

## Three layers of gating

Authentication is enforced at three levels with distinct jobs:

1. **Edge gate (middleware, `proxy.ts`)** — coarse and fast. Runs server-side before a
   protected route renders. It only checks **presence** of a `kc_token` cookie; it never
   reads the value. Public paths: `/`, `/login`, `/signup`, `/logout`, `/invite/*`,
   `silent-check-sso.html`. No cookie on a protected path → 307 to `/login`.
2. **Client gate (`KeycloakInit`)** — authoritative. Waits for `initKeycloak()` to resolve,
   then either renders the portal (session confirmed) or redirects to `/login` (no session).
3. **API (backend)** — the real security boundary. Validates the signed JWT on every
   request. The cookie and client gates are UX; the token is what actually grants data.

---

## Login

1. User clicks "Continue to sign-in" → `login()` (`keycloak.ts`).
2. `login()` `await initKeycloak()` (idempotent; sets up the keycloak-js adapter — calling
   `kc.login()` before `init()` throws), then `kc.login({ redirectUri: ${origin}/login })`.
   **The redirect target is `/login`, not the marketing root** — `/login` is the page that
   runs init + routing. (Returning to `/` would strand the user on `…/#state=…&code=…`.)
3. Keycloak authenticates and redirects back to `/login#state=…&code=…`.
4. `/login` (`page.tsx`) on mount calls `initKeycloak()`:
   - keycloak-js parses the callback, validates the token, and `setAuth(decodedPayload)`
     populates the store with the portal role.
   - `setAuthCookie()` writes the `kc_token` gate cookie (see below).
5. The page subscribes to the store and routes by role:
   - `landlord` → `/dashboard`
   - `tenant` → `/tenant/dashboard`
   - `admin` → `/admin/dashboard` (the platform-wide stakeholder analytics portal; the admin
     `KeycloakInit` gate additionally bounces any non-admin role back to `/login`).

On a portal route, `KeycloakInit` runs the same `initKeycloak()` (the promise is cached),
confirms the session, and renders the portal — or redirects to `/login` if unauthenticated.

---

## The `kc_token` gate cookie (sentinel, not the JWT)

The middleware needs *something* to gate on server-side, but the real token is in JS
memory. So the real-auth path writes a **sentinel** cookie:

- Name `kc_token`, value `kc.authenticated` — **a marker, never the JWT.** The middleware
  only checks presence (the dev-bypass path writes a fake `mock.dev.token`), so the value
  carries no credential.
- `Path=/; SameSite=Lax`, `Secure` on HTTPS, `Max-Age` tied to the session (refresh-token
  exp), refreshed on every token renewal (`onTokenExpired` → `updateToken` → `setAuthCookie`).
- Cleared (`clearAuthCookie`) on no-session, refresh failure, and logout.

**Security properties:** no credential material in the cookie; it's scoped to
`app.myproperty.works` and never reaches `api.` (different host); `SameSite=Lax` + the fact
that the API authenticates the Bearer header (not this cookie) means a forged cross-site
request gains nothing. The `Max-Age` makes the edge gate self-close near real session end,
so a long-idle tab doesn't even get protected HTML.

> **Why this exists:** without it, the middleware (which gates on `kc_token`) would never
> see a cookie under real auth — that cookie was previously only minted by the middleware
> itself in dev/bypass — so every protected route in prod would 307 back to `/login`, and
> post-login routing to `/dashboard` would loop.

---

## The authoritative client gate (`KeycloakInit`)

Both portal layouts wrap their content in `KeycloakInit`, which is a **render gate**:

- It awaits `initKeycloak()` (or, in dev-bypass, sets a fixture identity).
- If no session → clear nothing extra, `router.replace("/login")`.
- If a session is confirmed → render the portal (children).
- Shows a loading state until init resolves.

This makes the client authoritative: a stale `kc_token` cookie (session expired but cookie
still present) no longer leaves the user sitting on a dashboard firing 401s — `KeycloakInit`
bounces them to `/login`. It also removes the fresh-login race where the portal could fire
queries before the token landed.

---

## Logout (end-session)

`signOut()` (`useAuth.ts`) must terminate the **Keycloak** session, not just local state:

- Real-auth mode: `logout(${origin}/logout)` → `keycloak.ts` clears the store + the
  `kc_token` cookie, then `kc.logout()` redirects the browser to Keycloak's **end-session
  endpoint** (terminating the SSO session / `KEYCLOAK_IDENTITY` cookie) and returns to
  `/logout`.
- Dev-bypass mode: clears the store + cached token locally and routes to `/logout` (no
  Keycloak round-trip).

The client's `myproperty-frontend` has `post.logout.redirect.uris: "+"`, which inherits the
redirect-URI pattern `https://app.myproperty.works/*`, so `/logout` is a valid post-logout
target.

> **Note (Google IdP):** end-session terminates the Keycloak session, but not the user's
> **Google** session. If they signed in via Google, the next sign-in can still be silent
> (Google returns immediately). That is expected social-login behaviour, not a logout bug.

---

## Dev auth bypass

`NEXT_PUBLIC_DEV_AUTH_BYPASS=true` (local only; `false` in all deployed builds) short-circuits
Keycloak: `KeycloakInit` sets a fixture identity and the middleware mints the mock
`kc_token` cookie, so the app runs end-to-end without a real Keycloak. A prod build warns
if it's ever enabled. Hardening it to dead-code-eliminate in prod builds is tracked in
[deployment-roadmap.md](./deployment-roadmap.md).
