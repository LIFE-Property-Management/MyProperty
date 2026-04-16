"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";
import type { TenantAccount } from "@/lib/types";

export function useTenantAccount() {
  return useQuery<TenantAccount>({
    queryKey: queryKeys.tenant.account(),
    queryFn: () =>
      apiClient.get<TenantAccount>(ENDPOINTS.tenantAccount).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}
