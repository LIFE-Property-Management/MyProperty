"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";
import { tenantDetailSchema, type TenantDetail } from "@/lib/types/landlord/tenant";

export function useLandlordTenantDetail(tenantId: string) {
  return useQuery<TenantDetail>({
    queryKey: queryKeys.landlord.tenant.detail(tenantId),
    queryFn: () =>
      apiClient
        .get(ENDPOINTS.landlordTenantById(tenantId))
        .then((r) => tenantDetailSchema.parse(r.data)),
  });
}
