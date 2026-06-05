"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { queryKeys } from "./queryKeys";
import type { PropertyType } from "@/lib/types/landlord/property";

interface UpdatePropertyInput {
    id: string;
    name: string;
    address: string;
    unitNumber?: string;
    propertyType: PropertyType;
}

export function useUpdateProperty() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, ...body }: UpdatePropertyInput) =>
            apiClient.put(ENDPOINTS.propertyById(id), body),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.landlord.property.all() });
            queryClient.invalidateQueries({ queryKey: queryKeys.landlord.property.detail(id) });
        },
    });
}
