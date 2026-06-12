"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";

// Landlord revokes one of their own Pending/Expired invites (POST
// /invites/{id}/revoke). Revoking frees the property's "Invitation pending"
// state, so it invalidates the invite list plus the property list/detail and
// the dashboard. Error UX is the caller's job (no onError, matching siblings).
export function useRevokeInvite() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (inviteId) => {
      await apiClient.post(ENDPOINTS.revokeInvite(inviteId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.landlord.invites.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.landlord.property.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.landlord.dashboard() });
    },
  });
}
