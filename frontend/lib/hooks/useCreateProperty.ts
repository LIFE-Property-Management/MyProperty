"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { ANALYTICS_EVENTS, capture } from "@/lib/analytics";
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
        onSuccess: (_data, variables) => {
            // Landlord activation funnel — step 3.
            capture(ANALYTICS_EVENTS.propertyCreated, { propertyType: variables.propertyType });
            queryClient.invalidateQueries({ queryKey: queryKeys.landlord.property.all() });
            queryClient.invalidateQueries({ queryKey: queryKeys.landlord.dashboard() });
        },
    });
}
