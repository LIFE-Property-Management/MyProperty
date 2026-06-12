"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";

// Tenant cancels their OWN active lease (POST /tenant/lease/cancel, no body —
// the tenant is resolved from the JWT). The backend terminates the lease and
// emails the landlord. On success we invalidate the lease query (its status
// flips to Terminated → 204 on refetch) and the /me query (the backend may flip
// the account to ReadOnly once the tenant has no active lease).
//
// Error UX is the caller's job (matches useTerminateLease / useSubmitReceipt):
// the confirm modal owns the error message. 404 (no active lease) / 409
// (already terminated) surface as a rejected mutation.
export function useCancelLease() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await apiClient.post(ENDPOINTS.cancelLease);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant.lease() });
      // useMe's query key is the literal ["me"] (see useMe.ts).
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
