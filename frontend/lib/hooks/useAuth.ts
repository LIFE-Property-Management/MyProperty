"use client";

import { useRouter } from "next/navigation";
import useAuthStore, { type DecodedPayload } from "@/lib/store/auth/useAuthStore";
import { clearCachedToken, logout as keycloakLogout } from "@/lib/auth/keycloak";
import { useMe } from "./useMe";

interface UseAuthReturn {
  user: DecodedPayload | null
  isAuthenticated: boolean
  isReadOnly: boolean
  isMeLoading: boolean
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { data: meData, isLoading: isMeLoading } = useMe();

  const isReadOnly = (() => {
    if (isMeLoading) return false;
    if (user?.portal !== "tenant") return false;
    return meData?.tenantAccountStatus === "ReadOnly";
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
    isAuthenticated: user !== null,
    isReadOnly,
    isMeLoading,
    signOut,
  };
}
