"use client";

import { useRouter } from "next/navigation";
import useAuthStore, { type DecodedPayload } from "@/lib/store/auth/useAuthStore";
import { clearCachedToken } from "@/lib/auth/keycloak";
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
    // TODO M3.2: Send refresh_token in the request body for a valid Keycloak end-session.
    // Real Keycloak returns 400 without it. MSW returns 204 in dev so the flow works locally.
    // Refresh token storage is not yet implemented — wire this when real Keycloak ships.
    await fetch(
      `${process.env.NEXT_PUBLIC_KEYCLOAK_URL}/realms/${process.env.NEXT_PUBLIC_KEYCLOAK_REALM}/protocol/openid-connect/logout`,
      { method: "POST" },
    ).catch(() => {
      // Fire-and-forget: if the call fails, proceed with local cleanup regardless.
    });
    useAuthStore.getState().clearAuth();
    clearCachedToken();
    router.push("/logout");
  };

  return {
    user,
    isAuthenticated: user !== null,
    isReadOnly,
    isMeLoading,
    signOut,
  };
}
