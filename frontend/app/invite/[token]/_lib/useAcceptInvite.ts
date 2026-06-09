"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { ANALYTICS_EVENTS, capture } from "@/lib/analytics";

export interface AcceptInviteInput {
  token: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  password: string;
}

export function useAcceptInvite() {
  const router = useRouter();
  return useMutation<void, Error, AcceptInviteInput>({
    mutationFn: async ({ token, firstName, lastName, phone, password }) => {
      await apiClient.post(ENDPOINTS.acceptInvite(token), {
        firstName,
        lastName,
        phone: phone || null,
        password,
      });
    },
    onSuccess: () => {
      // Tenant onboarding funnel — final step (lease accepted + account created).
      capture(ANALYTICS_EVENTS.inviteAccepted);
      router.push("/login");
    },
  });
}
