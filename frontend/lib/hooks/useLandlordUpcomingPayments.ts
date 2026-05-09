"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";
import {
  upcomingPaymentsResponseSchema,
  type UpcomingPaymentsResponse,
} from "@/lib/types/landlord/dashboard";

export function useLandlordUpcomingPayments(page: number, pageSize: number) {
  return useQuery<UpcomingPaymentsResponse>({
    queryKey: queryKeys.landlord.payment.upcoming(page, pageSize),
    queryFn: () =>
      apiClient
        .get(ENDPOINTS.landlordUpcomingPayments, { params: { page, pageSize } })
        .then((r) => upcomingPaymentsResponseSchema.parse(r.data)),
    placeholderData: (prev) => prev,
  });
}
