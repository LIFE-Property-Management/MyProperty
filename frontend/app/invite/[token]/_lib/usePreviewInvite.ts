"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/hooks/queryKeys";
import { invitePreviewSchema, type InvitePreview } from "./invite";

// Fetches the live invite preview for the token in the email link. The endpoint
// is anonymous and returns 200 for ANY resolved invite (with its real status) —
// 404 only for an unknown token-hash, which the page surfaces as "invalid
// invite". `retry: false` so a 404 fails fast rather than retrying a dead link.
export function usePreviewInvite(token: string) {
  return useQuery<InvitePreview>({
    queryKey: queryKeys.invite.preview(token),
    queryFn: async () => {
      const { data } = await apiClient.get(ENDPOINTS.inviteByToken(token));
      return invitePreviewSchema.parse(data);
    },
    retry: false,
  });
}
