"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";

// Landlord re-issues a Pending/Expired invite (POST /invites/{id}/resend): the
// same row's token is regenerated, ExpiresAt resets, status returns to Pending,
// and the email is re-sent. The InviteResentDto body is ignored. Resend does not
// change property occupancy (still pending), so only the invite list is
// invalidated.
export function useResendInvite() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (inviteId) => {
      await apiClient.post(ENDPOINTS.resendInvite(inviteId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.landlord.invites.all() });
    },
  });
}
