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
