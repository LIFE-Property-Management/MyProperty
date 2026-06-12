"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";

// Landlord re-issues a Pending/Expired invite (POST /invites/{id}/resend): the
// same row's token is regenerated, ExpiresAt resets, status returns to Pending,
// and the email is re-sent. The InviteResentDto body is ignored. Resending an
// *Expired* invite flips it back to effective-pending, which DOES change the
// property's occupancy ("Add lease" → "Invitation pending") — so it invalidates
// the property list/detail and dashboard too, mirroring useRevokeInvite in
// reverse. (Without this, the property still shows "Add lease" and a second click
// would create a duplicate pending invite.)
export function useResendInvite() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (inviteId) => {
      await apiClient.post(ENDPOINTS.resendInvite(inviteId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.landlord.invites.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.landlord.property.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.landlord.dashboard() });
    },
  });
}
