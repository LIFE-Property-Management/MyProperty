"use client";

import { useMutation } from "@tanstack/react-query";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";

export interface AcceptInviteInput {
  token: string;
  formData: FormData;
}

export function useAcceptInvite() {
  return useMutation<void, Error, AcceptInviteInput>({
    mutationFn: async ({ token, formData }) => {
      await apiClient.post(ENDPOINTS.acceptInvite(token), formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
  });
}
