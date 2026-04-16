"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";
import type { PaymentHistoryResponse } from "@/lib/types";

export function usePaymentHistory(page: number, pageSize: number = 10) {
  return useQuery<PaymentHistoryResponse>({
    queryKey: queryKeys.tenant.payment.history(page, pageSize),
    queryFn: () =>
      apiClient
        .get<PaymentHistoryResponse>(ENDPOINTS.paymentHistory, {
          params: { page, pageSize },
        })
        .then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
