"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";
import type { PropertyType } from "@/lib/types/landlord/property";

interface CreatePropertyInput {
    name: string;
    address: string;
    unitNumber?: string;
    propertyType: PropertyType;
}

export function useCreateProperty() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: CreatePropertyInput) =>
            apiClient.post(ENDPOINTS.properties, input).then((r) => r.data as { id: string }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.landlord.property.all() });
            queryClient.invalidateQueries({ queryKey: queryKeys.landlord.dashboard() });
        },
    });
}
