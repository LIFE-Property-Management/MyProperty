"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";

// `reason` is validated server-side by RejectPaymentValidator (required,
// non-whitespace, 10–500 chars). Validate at the form boundary with Zod when the
// reject UI is built — do not validate here, mirroring useSubmitReceipt.
export interface RejectPaymentInput {
  paymentId: string;
  reason: string;
}

// Landlord rejects a Pending payment with a required reason (Pending → Rejected).
export function useRejectPayment() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, RejectPaymentInput>({
    mutationFn: async ({ paymentId, reason }: RejectPaymentInput) => {
      // Body key is camelCase `reason`; the API binds it case-insensitively to
      // RejectPaymentRequestBody.Reason.
      await apiClient.post(ENDPOINTS.rejectPayment(paymentId), { reason });
    },
    onSuccess: () => {
      // Rejecting changes the upcoming/pending list, the dashboard counts, and
      // the tenant's payment-history status badge.
      queryClient.invalidateQueries({ queryKey: queryKeys.landlord.payment.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.landlord.dashboard() });
      queryClient.invalidateQueries({ queryKey: queryKeys.landlord.tenant.all() });
    },
  });
}
