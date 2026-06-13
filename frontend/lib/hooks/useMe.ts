"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import useAuthStore from "@/lib/store/auth/useAuthStore";
import { tenantAccountStatusSchema } from "@/lib/types";

// Mirrors the relevant slice of the backend MeDto (GET /me). We only consume
// accountStatus (drives read-only mode); Zod strips the other identity fields.
// It is nullable on the backend (TenantAccountStatus?), so accept null too.
const meResponseSchema = z.object({
  accountStatus: tenantAccountStatusSchema.nullable(),
})

export type MeResponse = z.infer<typeof meResponseSchema>

export function useMe() {
  const user = useAuthStore((s) => s.user)
  return useQuery({
    queryKey: ["me"],
    queryFn: () =>
      apiClient.get(ENDPOINTS.me).then((r) => meResponseSchema.parse(r.data)),
    enabled: user?.portal === "tenant",
    staleTime: 5 * 60 * 1000,
  })
}
