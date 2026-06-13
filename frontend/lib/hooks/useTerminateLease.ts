"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";

// Landlord terminates a lease (PATCH /leases/{id}/terminate). Terminating frees
// the property (Leased → Vacant), so it invalidates the property list/detail,
// the landlord tenants list, and the dashboard. The leaseId comes from the
// property DTO (PropertyDto.activeLeaseId / PropertyTenantDto.leaseId).
export function useTerminateLease() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (leaseId) => {
      await apiClient.patch(ENDPOINTS.terminateLease(leaseId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.landlord.property.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.landlord.tenant.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.landlord.dashboard() });
    },
  });
}
