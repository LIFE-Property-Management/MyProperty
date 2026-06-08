"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { ANALYTICS_EVENTS, capture } from "@/lib/analytics";
import { queryKeys } from "./queryKeys";
import type { ManualRequestFormValues } from "@/lib/types";

export function useSubmitManualRequest() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ManualRequestFormValues>({
    mutationFn: async (input: ManualRequestFormValues) => {
      await apiClient.post(ENDPOINTS.submitManualRequest, input);
    },
    onSuccess: () => {
      // Payment-collection funnel — manual-request completion.
      capture(ANALYTICS_EVENTS.paymentManualRequestSubmitted);
      queryClient.invalidateQueries({
        queryKey: queryKeys.tenant.payment.current(),
      });
    },
  });
}
