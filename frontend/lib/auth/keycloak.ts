// Mock Keycloak adapter. Replace with a real adapter by keeping the same
// exported surface: getToken() and initKeycloak(). Callers must not
// import anything else from this file.

"use client";

import type { TenantAccountStatus } from "@/lib/types";
import useTenantStore from "@/lib/store/useTenantStore";

const FAKE_JWT =
  "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIwMTkzYjQyZC1kZjVhLTdmMmEtOGMzYi1lMmY4YTk3YzE0NTYiLCJlbWFpbCI6InRlbmFudEBkZXYubG9jYWwiLCJ0ZW5hbnRBY2NvdW50U3RhdHVzIjoiQWN0aXZlIn0.sig";

let initialized = false;

interface DecodedPayload {
  sub: string;
  email: string;
  tenantAccountStatus: TenantAccountStatus;
}

function isDecodedPayload(x: unknown): x is DecodedPayload {
  if (typeof x !== "object" || x === null) return false;
  const obj = x as Record<string, unknown>;
  return (
    typeof obj.sub === "string" &&
    typeof obj.email === "string" &&
    (obj.tenantAccountStatus === "Active" ||
      obj.tenantAccountStatus === "ReadOnly")
  );
}

function decodePayload(token: string): DecodedPayload {
  const base64Url = token.split(".")[1];
  let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const json = atob(base64);
  const parsed: unknown = JSON.parse(json);
  if (!isDecodedPayload(parsed)) {
    throw new Error("Invalid JWT payload");
  }
  return parsed;
}

export function getToken(): string | null {
  return FAKE_JWT;
}

export function initKeycloak(): void {
  if (initialized) return;
  try {
    const payload = decodePayload(FAKE_JWT);
    useTenantStore.getState().setAuth({
      userId: payload.sub,
      email: payload.email,
      tenantAccountStatus: payload.tenantAccountStatus,
    });
    initialized = true;
  } catch (e) {
    console.error("initKeycloak failed", e);
  }
}
