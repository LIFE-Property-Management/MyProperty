// Mock Keycloak adapter. Replace with a real adapter by keeping the same
// exported surface: getToken(), initKeycloak(), and clearCachedToken(). Callers
// must not import anything else from this file except for testing purposes.

"use client";

import useAuthStore, { type DecodedPayload } from "@/lib/store/auth/useAuthStore";

const FAKE_JWT =
  "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIwMTkzYjQyZC1kZjVhLTdmMmEtOGMzYi1lMmY4YTk3YzE0NTYiLCJlbWFpbCI6InRlbmFudEBkZXYubG9jYWwiLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsidGVuYW50Il19fQ.sig";

let cachedToken: string | null = null;
let initialized = false;

const PORTAL_ROLES = ["tenant", "landlord", "admin"] as const;
type PortalRole = (typeof PORTAL_ROLES)[number];

function isPortalRole(r: string): r is PortalRole {
  return (PORTAL_ROLES as readonly string[]).includes(r);
}

function isDecodedPayload(x: unknown): x is DecodedPayload {
  if (typeof x !== "object" || x === null) return false;
  const obj = x as Record<string, unknown>;
  return (
    typeof obj.portal === "string" &&
    isPortalRole(obj.portal) &&
    typeof obj.sub === "string" &&
    typeof obj.email === "string"
  );
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
    ? ((parsed.realm_access as Record<string, unknown>).roles as string[])
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

export function getToken(): string | null {
  return cachedToken;
}

export function clearCachedToken(): void {
  cachedToken = null;
}

export function initKeycloak(): void {
  if (initialized) return;
  try {
    const payload = decodePayload(FAKE_JWT);
    useAuthStore.getState().setAuth(payload);
    cachedToken = FAKE_JWT;
    initialized = true;
  } catch (e) {
    console.error("initKeycloak failed", e);
  }
}
