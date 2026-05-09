// MyProperty — Tenant Portal — Combined Zustand store
// Composes UI and notification slices behind the devtools middleware.
// No persist middleware: UI/notification state should reset on refresh.
// Auth identity is handled separately by useAuthStore (lib/store/auth).

import { create } from "zustand"
import { devtools } from "zustand/middleware"
import { createUiSlice, type UiSlice } from "./tenant/uiSlice"
import {
    createNotificationSlice,
    type NotificationSlice,
} from "./tenant/notificationSlice"

export type TenantStore = UiSlice & NotificationSlice

const useTenantStore = create<TenantStore>()(
    devtools(
        (...args) => ({
            ...createUiSlice(...args),
            ...createNotificationSlice(...args),
        }),
        { name: "TenantStore" },
    ),
)

export default useTenantStore
