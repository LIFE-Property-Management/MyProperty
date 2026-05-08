// Callers are responsible for building FormData from their
// ReceiptUploadFormSchema-validated values. Do not validate here —
// React Hook Form + Zod handles that at the form boundary.

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";

export function useSubmitReceipt() {
    const queryClient = useQueryClient();

    return useMutation<void, Error, FormData>({
        mutationFn: async (formData: FormData) => {
            await apiClient.post(ENDPOINTS.submitReceipt, formData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: queryKeys.tenant.payment.current(),
            });
        },
    });
}
