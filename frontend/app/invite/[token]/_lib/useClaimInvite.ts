"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { ANALYTICS_EVENTS, capture } from "@/lib/analytics";

export interface ClaimInviteInput {
  token: string;
}

// Returning-tenant accept: an authenticated tenant whose JWT email matches the
// invite claims it with no body (identity comes from the bearer token) — no
// Keycloak provisioning, no password. The backend creates the lease and marks
// the invite Accepted, returning InviteAcceptedDto (ignored here). A 403 means
// the logged-in email doesn't match the invite; the caller surfaces that.
export function useClaimInvite() {
  const router = useRouter();
  return useMutation<void, Error, ClaimInviteInput>({
    mutationFn: async ({ token }) => {
      await apiClient.post(ENDPOINTS.claimInvite(token));
    },
    onSuccess: () => {
      // Tenant onboarding funnel — final step (lease accepted via claim).
      capture(ANALYTICS_EVENTS.inviteAccepted);
      // Already authenticated — land them on their lease, not the login page.
      router.push("/tenant/dashboard");
    },
  });
}
