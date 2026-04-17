// MyProperty — Tenant Portal — Combined Zustand store
// Composes auth, UI, and notification slices behind the devtools middleware.
// No persist middleware: auth re-derives from Keycloak on every load,
// and UI/notification state should reset on refresh.

import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { createAuthSlice, type AuthSlice } from "./tenant/authSlice"
import { createUiSlice, type UiSlice } from "./tenant/uiSlice"
import {
  createNotificationSlice,
  type NotificationSlice,
} from "./tenant/notificationSlice"

export type TenantStore = AuthSlice & UiSlice & NotificationSlice

const useTenantStore = create<TenantStore>()(
  devtools(
    (...args) => ({
      ...createAuthSlice(...args),
      ...createUiSlice(...args),
      ...createNotificationSlice(...args),
    }),
    { name: "TenantStore" },
  ),
)

export default useTenantStore
