"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";

export interface AcceptInviteInput {
  token: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  password: string;
}

export function useAcceptInvite() {
  const router = useRouter();
  return useMutation<void, Error, AcceptInviteInput>({
    mutationFn: async ({ token, firstName, lastName, phone, password }) => {
      await apiClient.post(ENDPOINTS.acceptInvite(token), {
        firstName,
        lastName,
        phone: phone || null,
        password,
      });
    },
    onSuccess: () => {
      router.push("/login");
    },
  });
}
