"use client";

import { useMutation } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";

interface CreateInviteInput {
    propertyId: string;
    email: string;
    firstName: string;
    lastName: string;
    proposedStartDate: string;
    proposedEndDate: string;
    proposedMonthlyRent: number;
    currency: string;
}

export function useCreateInvite() {
    return useMutation({
        mutationFn: (input: CreateInviteInput) =>
            apiClient.post(ENDPOINTS.createInvite, input).then((r) => r.data),
    });
}
