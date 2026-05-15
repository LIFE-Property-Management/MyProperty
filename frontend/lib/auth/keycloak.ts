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

export function initKeycloak(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const kc = getInstance();
    const authenticated = await kc.init({
      onLoad: "login-required",
      checkLoginIframe: false,
    });
    if (authenticated && kc.token) {
      const payload = decodePayload(kc.token);
      useAuthStore.getState().setAuth(payload);
      kc.onTokenExpired = () => {
        kc.updateToken(60).catch(() => {
          useAuthStore.getState().clearAuth();
        });
      };
    }
  })();
  return initPromise;
}

export async function logout(): Promise<void> {
  const kc = _keycloak;
  _keycloak = null;
  initPromise = null;
  useAuthStore.getState().clearAuth();
  await kc?.logout({ redirectUri: window.location.origin });
}
