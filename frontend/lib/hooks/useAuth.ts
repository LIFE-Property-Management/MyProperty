"use client";

import { useRouter } from "next/navigation";
import useAuthStore, { type DecodedPayload } from "@/lib/store/auth/useAuthStore";
import { clearCachedToken, logout as keycloakLogout } from "@/lib/auth/keycloak";
import { useMe } from "./useMe";

interface UseAuthReturn {
  user: DecodedPayload | null
  /**
   * Profile names from /me (identity lives on the JWT, names do not). Null when
   * absent/blank. Optional so consumers that don't need them (and their test
   * mocks) can ignore them — only the account block reads these today.
   */
  firstName?: string | null
  lastName?: string | null
  isAuthenticated: boolean
  isReadOnly: boolean
  isMeLoading: boolean
  signOut: () => Promise<void>
}

/** Trim and collapse a blank/whitespace-only name field to null. */
function normalizeName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: meData, isLoading: isMeLoading } = useMe();

  const firstName = normalizeName(meData?.firstName);
  const lastName = normalizeName(meData?.lastName);

  const isReadOnly = (() => {
    if (isMeLoading) return false;
    if (user?.portal !== "tenant") return false;
    return meData?.accountStatus === "ReadOnly";
  })();

  const signOut = async () => {
    // Dev bypass has no real Keycloak session — clear locally and show the
    // signed-out page.
    if (process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true") {
      useAuthStore.getState().clearAuth();
      clearCachedToken();
      router.push("/logout");
      return;
    }
    // Real logout must terminate the Keycloak SSO session (and clear the gate
    // cookie) via the end-session endpoint — otherwise the session survives and
    // check-sso silently signs the user back in. Returns to the /logout page.
    await keycloakLogout(`${window.location.origin}/logout`);
  };

  return {
    user,
    firstName,
    lastName,
    isAuthenticated: user !== null,
    isReadOnly,
    isMeLoading,
    signOut,
  };
}
