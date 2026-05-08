// MyProperty — Tenant Portal — Auth slice
// Holds identity and access-level state derived from the Keycloak token on app load.
// The Keycloak token itself is NOT stored here — it belongs in the HTTP layer.

import type { StateCreator } from "zustand"
import type { TenantAccountStatus } from "@/lib/types"
import type { TenantStore } from "../useTenantStore"

interface AuthState {
  userId: string | null
  email: string | null
  tenantAccountStatus: TenantAccountStatus | null
  isReadOnly: boolean
}

interface AuthActions {
  setAuth: (payload: AuthPayload) => void
  clearAuth: () => void
}

// What setAuth receives — does NOT include isReadOnly (that's derived from tenantAccountStatus)
interface AuthPayload {
  userId: string
  email: string
  tenantAccountStatus: TenantAccountStatus
}

export type AuthSlice = AuthState & AuthActions

export const createAuthSlice: StateCreator<
  TenantStore,
  [["zustand/devtools", never]],
  [],
  AuthSlice
> = (set) => ({
  userId: null,
  email: null,
  tenantAccountStatus: null,
  isReadOnly: false,

  setAuth: (payload) =>
    set({
      userId: payload.userId,
      email: payload.email,
      tenantAccountStatus: payload.tenantAccountStatus,
      isReadOnly: payload.tenantAccountStatus === "ReadOnly",
    }),

  clearAuth: () =>
    set({
      userId: null,
      email: null,
      tenantAccountStatus: null,
      isReadOnly: false,
    }),
})
