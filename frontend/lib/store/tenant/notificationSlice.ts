// MyProperty — Tenant Portal — Notification slice
// Manages a toast notification queue with auto-dismiss via setTimeout.

import type { StateCreator } from "zustand"
import type { TenantStore } from "../useTenantStore"

export interface Notification {
  id: string
  type: "success" | "error" | "info"
  message: string
  duration: number // milliseconds
}

interface NotificationState {
  notifications: Notification[]
}

interface NotificationActions {
  addNotification: (notification: Omit<Notification, "id">) => void
  dismissNotification: (id: string) => void
}

export type NotificationSlice = NotificationState & NotificationActions

export const createNotificationSlice: StateCreator<
  TenantStore,
  [["zustand/devtools", never]],
  [],
  NotificationSlice
> = (set, get) => ({
  notifications: [],

  addNotification: (notification) => {
    const id = crypto.randomUUID()
    const newNotification: Notification = { ...notification, id }

    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }))

    // Schedule auto-dismiss. dismissNotification is idempotent, so it's safe
    // if the user already dismissed manually before the timeout fires.
    setTimeout(() => {
      get().dismissNotification(id)
    }, notification.duration)
  },

  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
})
