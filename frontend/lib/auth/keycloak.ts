"use client";

import Keycloak from "keycloak-js";
import useAuthStore, { type DecodedPayload } from "@/lib/store/auth/useAuthStore";
import { requirePublicEnv } from "@/lib/utils/env";

const PORTAL_ROLES = ["tenant", "landlord", "admin"] as const;
type PortalRole = (typeof PORTAL_ROLES)[number];

function isPortalRole(r: string): r is PortalRole {
  return (PORTAL_ROLES as readonly string[]).includes(r);
}

export function decodePayload(token: string): DecodedPayload {
  const base64Url = token.split(".")[1];
  let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const json = atob(base64);
  const parsed = JSON.parse(json) as Record<string, unknown>;

  const roles: string[] = Array.isArray(
      (parsed.realm_access as Record<string, unknown> | undefined)?.roles,
  )
      ? ((parsed.realm_access as Record<string, unknown>).roles as string[]).map(
          (r) => r.toLowerCase(),
      )
      : [];

  const matched = roles.filter(isPortalRole);

  if (matched.length === 0) {
    throw new Error("JWT has no recognized portal role");
  }
  if (matched.length > 1) {
    throw new Error("JWT has multiple portal roles");
  }

  return {
    portal: matched[0],
    sub: parsed.sub as string,
    email: parsed.email as string,
  };
}

let _keycloak: Keycloak | null = null;
let initPromise: Promise<void> | null = null;

// Edge-gate marker cookie. The middleware (proxy.ts) only checks this cookie's
// PRESENCE to let protected routes through — it never reads the value (the dev
// bypass path sets a fake "mock.dev.token"). So the real-auth path sets a
// non-sensitive sentinel, never the JWT: the actual token stays in keycloak-js
// memory and is sent to the API as a Bearer header. Max-Age is tied to the
// session so the gate self-closes near real expiry instead of lingering.
const AUTH_COOKIE = "kc_token";
const AUTH_COOKIE_VALUE = "kc.authenticated";

function setAuthCookie(): void {
  const kc = _keycloak;
  if (!kc) return;
  const expSec = kc.refreshTokenParsed?.exp ?? kc.tokenParsed?.exp;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const maxAge =
    expSec !== undefined
      ? `; Max-Age=${Math.max(0, Math.floor(expSec - Date.now() / 1000))}`
      : "";
  document.cookie = `${AUTH_COOKIE}=${AUTH_COOKIE_VALUE}; Path=/; SameSite=Lax${secure}${maxAge}`;
}

function clearAuthCookie(): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${AUTH_COOKIE}=; Path=/; SameSite=Lax${secure}; Max-Age=0`;
}

function getInstance(): Keycloak {
  if (!_keycloak) {
    _keycloak = new Keycloak({
      url: requirePublicEnv("NEXT_PUBLIC_KEYCLOAK_URL"),
      realm: requirePublicEnv("NEXT_PUBLIC_KEYCLOAK_REALM"),
      clientId: requirePublicEnv("NEXT_PUBLIC_KEYCLOAK_CLIENT_ID"),
    });
  }
  return _keycloak;
}

export function getToken(): string | null {
  return _keycloak?.token ?? null;
}

export function clearCachedToken(): void {
  _keycloak = null;
  initPromise = null;
}

export async function login(redirectUri?: string): Promise<void> {
  // keycloak-js sets up its internal adapter during init(); calling login()
  // before init() throws "this[#adapter] is undefined". The /login and landing
  // routes are not under a portal layout that calls initKeycloak, so ensure
  // initialization here (initKeycloak is idempotent) before redirecting.
  await initKeycloak();
  getInstance().login({
    redirectUri: redirectUri ?? `${window.location.origin}/login`,
  });
}

// Keycloak's hosted "Forgot password?" (reset-credentials) entry URL. We build
// it from the same three public env vars getInstance() uses rather than going
// through keycloak-js: the reset flow is unauthenticated, so there is no token
// to init and nothing to track — it's a plain hand-off, mirroring how login()
// redirects to Keycloak. Keycloak collects the email, mails a reset link, and
// hosts the new-password form (the emailed link lands on Keycloak's own page —
// there is no in-app /reset-password route). Requires the realm's
// resetPasswordAllowed=true and a configured smtpServer; see
// infrastructure/keycloak/realm-export.template.json.
export function resetPasswordUrl(): string {
  const base = requirePublicEnv("NEXT_PUBLIC_KEYCLOAK_URL").replace(/\/+$/, "");
  const realm = requirePublicEnv("NEXT_PUBLIC_KEYCLOAK_REALM");
  const clientId = requirePublicEnv("NEXT_PUBLIC_KEYCLOAK_CLIENT_ID");
  const query = new URLSearchParams({ client_id: clientId });
  return `${base}/realms/${encodeURIComponent(realm)}/login-actions/reset-credentials?${query}`;
}

export function resetPassword(): void {
  window.location.assign(resetPasswordUrl());
}

export function initKeycloak(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const kc = getInstance();
    let authenticated = false;
    try {
      authenticated = await kc.init({
        onLoad: "check-sso",
        checkLoginIframe: false,
        silentCheckSsoRedirectUri: window.location.origin + "/silent-check-sso.html",
      });
    } catch {
      // Silent SSO check timed out or failed — treat as not authenticated.
      // This is non-fatal: the user can still click "Continue to sign-in".
      useAuthStore.getState().clearAuth();
      clearAuthCookie();
      return;
    }
    if (authenticated && kc.token) {
      const payload = decodePayload(kc.token);
      useAuthStore.getState().setAuth(payload);
      setAuthCookie();
      kc.onTokenExpired = () => {
        kc.updateToken(60)
          .then(() => setAuthCookie())
          .catch(() => {
            useAuthStore.getState().clearAuth();
            clearAuthCookie();
          });
      };
    } else {
      useAuthStore.getState().clearAuth();
      clearAuthCookie();
    }
  })();
  return initPromise;
}

export async function logout(redirectUri?: string): Promise<void> {
  const kc = _keycloak;
  _keycloak = null;
  initPromise = null;
  useAuthStore.getState().clearAuth();
  clearAuthCookie();
  // kc.logout() redirects the browser to Keycloak's end-session endpoint, which
  // terminates the SSO session server-side (clearing KEYCLOAK_IDENTITY) before
  // returning to redirectUri. Without this a later check-sso silently re-auths.
  await kc?.logout({ redirectUri: redirectUri ?? window.location.origin });
}
