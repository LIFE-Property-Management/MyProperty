"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";
import {
  invitesResponseSchema,
  type InvitesResponse,
  type InviteStatus,
} from "@/lib/types/landlord/invite";

// Paginated list of the landlord's own invites (newest first), optionally
// filtered by status. GET /invites?page=&pageSize=&status=. placeholderData
// keeps the previous page on screen while the next page loads (mirrors
// useLandlordProperties / useLandlordUpcomingPayments).
export function useLandlordInvites(
  page: number,
  pageSize: number,
  status?: InviteStatus,
) {
  return useQuery<InvitesResponse>({
    queryKey: queryKeys.landlord.invites.list(page, pageSize, status),
    queryFn: () =>
      apiClient
        .get(ENDPOINTS.landlordInvites, {
          params: { page, pageSize, ...(status ? { status } : {}) },
        })
        .then((r) => invitesResponseSchema.parse(r.data)),
    placeholderData: (prev) => prev,
  });
}
