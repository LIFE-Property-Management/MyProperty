"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";
import type { Payment } from "@/lib/types";

export function useCurrentPayment() {
  return useQuery<Payment>({
    queryKey: queryKeys.tenant.payment.current(),
    queryFn: () =>
      apiClient.get<Payment>(ENDPOINTS.currentPayment).then((r) => r.data),
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: false,
  });
}
