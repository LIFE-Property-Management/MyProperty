"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";
import {
  upcomingPaymentsResponseSchema,
  type UpcomingPaymentsResponse,
} from "@/lib/types/landlord/dashboard";

const EMPTY_RESPONSE = (page: number, pageSize: number): UpcomingPaymentsResponse => ({
  items: [],
  totalCount: 0,
  page,
  pageSize,
});

export function useLandlordUpcomingPayments(page: number, pageSize: number) {
  return useQuery<UpcomingPaymentsResponse>({
    queryKey: queryKeys.landlord.payment.upcoming(page, pageSize),
    queryFn: async () => {
      try {
        const r = await apiClient.get(ENDPOINTS.landlordUpcomingPayments, { params: { page, pageSize } });
        return upcomingPaymentsResponseSchema.parse(r.data);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return EMPTY_RESPONSE(page, pageSize);
        }
        throw error;
      }
    },
    placeholderData: (prev) => prev,
  });
}
