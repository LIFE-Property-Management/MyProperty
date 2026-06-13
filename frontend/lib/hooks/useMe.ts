"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import useAuthStore from "@/lib/store/auth/useAuthStore";
import { tenantAccountStatusSchema } from "@/lib/types";

// Mirrors the relevant slice of the backend MeDto (GET /me): the name fields
// (avatar initials + display name) and accountStatus (drives tenant read-only
// mode). Zod strips the remaining identity fields (id/email/roles/phone).
// firstName/lastName are non-null strings on the backend but may be empty, and
// older fixtures omit them — accept missing/null so parsing never hard-fails on
// identity. accountStatus is nullable on the backend (TenantAccountStatus?).
const meResponseSchema = z.object({
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  accountStatus: tenantAccountStatusSchema.nullable(),
})

export type MeResponse = z.infer<typeof meResponseSchema>

export function useMe() {
  const user = useAuthStore((s) => s.user)
  return useQuery({
    queryKey: ["me"],
    queryFn: () =>
      apiClient.get(ENDPOINTS.me).then((r) => meResponseSchema.parse(r.data)),
    // /me is the identity endpoint for every authenticated user (and lazily
    // upserts the User row), so fire it for any portal — landlords/admins need
    // their name for the account block, tenants additionally need accountStatus.
    enabled: user !== null,
    staleTime: 5 * 60 * 1000,
  })
}
