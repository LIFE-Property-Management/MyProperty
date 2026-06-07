"use client";

import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";
import {
  tenantsResponseSchema,
  type TenantsResponse,
} from "@/lib/types/landlord/tenant";

export function useLandlordTenants(page: number, pageSize: number) {
  return useQuery<TenantsResponse>({
    queryKey: queryKeys.landlord.tenant.list(page, pageSize),
    queryFn: () =>
      apiClient
        .get(ENDPOINTS.landlordTenants, { params: { page, pageSize } })
        .then((r) => tenantsResponseSchema.parse(r.data)),
    placeholderData: (prev) => prev,
  });
}
