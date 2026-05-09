// Resets the global Zustand tenant store to its initial shape between tests.
// Because the store is a module-level singleton, state survives across tests
// unless explicitly cleared — this helper is called from beforeEach.

import useTenantStore, { type TenantStore } from "@/lib/store/useTenantStore";

const INITIAL_STATE: Partial<TenantStore> = {
  activeModal: null,
  activePaymentId: null,
  notifications: [],
};

export function resetTenantStore(): void {
  useTenantStore.setState(INITIAL_STATE, false);
}
