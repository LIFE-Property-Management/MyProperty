"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { ANALYTICS_EVENTS, capture } from "@/lib/analytics";
import { queryKeys } from "./queryKeys";
import type { CreateInviteInput } from "@/lib/types/landlord/invite";

// Creates an invite (POST /invites). The InviteCreatedDto body is intentionally
// ignored: per the TanStack-is-the-source-of-truth contract the UI invalidates
// and refetches rather than treating the mutation payload as state.
//
// On success it fires tenant_invited — the final step of the landlord activation
// funnel — and invalidates the invite list plus the property list/detail (the
// launching property flips to "Invitation pending") and the landlord dashboard.
export function useCreateInvite() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, CreateInviteInput>({
    mutationFn: async (input) => {
      await apiClient.post(ENDPOINTS.landlordInvites, input);
    },
    onSuccess: (_data, variables) => {
      capture(ANALYTICS_EVENTS.tenantInvited, { propertyId: variables.propertyId });
      queryClient.invalidateQueries({ queryKey: queryKeys.landlord.invites.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.landlord.property.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.landlord.dashboard() });
    },
  });
}
