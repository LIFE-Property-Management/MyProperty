// MyProperty — Tenant Portal — UI slice
// Tracks which modal is currently open and which payment (if any) it targets.

import type { StateCreator } from "zustand"
import type { TenantStore } from "../useTenantStore"

export type ModalType = "receiptUpload" | "manualRequest"

interface UiState {
  activeModal: ModalType | null
  activePaymentId: string | null
}

interface UiActions {
  openModal: (modal: ModalType, paymentId: string | null) => void
  closeModal: () => void
}

export type UiSlice = UiState & UiActions

export const createUiSlice: StateCreator<
  TenantStore,
  [["zustand/devtools", never]],
  [],
  UiSlice
> = (set) => ({
  activeModal: null,
  activePaymentId: null,

  openModal: (modal, paymentId) =>
    set({
      activeModal: modal,
      activePaymentId: paymentId,
    }),

  closeModal: () =>
    set({
      activeModal: null,
      activePaymentId: null,
    }),
})
