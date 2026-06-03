"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";

export function useDeleteProperty() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => apiClient.delete(ENDPOINTS.propertyById(id)),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.landlord.property.list(1, 10) });
            queryClient.invalidateQueries({ queryKey: queryKeys.landlord.dashboard() });
        },
    });
}
