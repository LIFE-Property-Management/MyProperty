"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";
import type { LeaseSummary } from "@/lib/types";

export function useLease() {
  return useQuery<LeaseSummary>({
    queryKey: queryKeys.tenant.lease(),
    queryFn: () =>
      apiClient.get<LeaseSummary>(ENDPOINTS.lease).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}
