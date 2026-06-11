"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";

// Landlord confirms a Pending payment (Pending → Confirmed, terminal).
// The API response body is intentionally ignored: per the SignalR/TanStack
// contract the client invalidates and refetches authoritative data rather than
// treating the mutation payload as canonical state.
export function useConfirmPayment() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (paymentId: string) => {
      await apiClient.post(ENDPOINTS.confirmPayment(paymentId));
    },
    onSuccess: () => {
      // Confirming changes the upcoming/pending list, the dashboard counts,
      // and the tenant's payment-history status badge.
      queryClient.invalidateQueries({ queryKey: queryKeys.landlord.payment.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.landlord.dashboard() });
      queryClient.invalidateQueries({ queryKey: queryKeys.landlord.tenant.all() });
    },
  });
}
