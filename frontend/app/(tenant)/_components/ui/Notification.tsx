'use client'

// Tenant Portal — NotificationContainer primitive.
// Reads the notification queue from the Zustand store and renders a stack
// of toasts top-center. Auto-dismiss is NOT handled here — notificationSlice
// owns that via setTimeout on addNotification. This component is purely
// presentation + manual-dismiss wiring.
//
// Container uses pointer-events-none so clicks pass through empty space
// around toasts (critical: the container is fixed, full-width, and sits
// above the Modal z-50 at z-60). Individual toasts opt back in with
// pointer-events-auto so their dismiss button remains clickable.
//
// Assumption: notification ids from the slice are unique (crypto.randomUUID).
// If a duplicate ever appears React will warn — fix it in the slice, not here.

import { motion, AnimatePresence } from 'framer-motion'
import useTenantStore from '@/lib/store/useTenantStore'

type NotificationType = 'success' | 'error' | 'info'

interface NotificationItemProps {
  id: string
  type: NotificationType
  message: string
  onDismiss: (id: string) => void
}

const CONTAINER_CLASSES =
  'fixed top-4 left-1/2 -translate-x-1/2 z-[60] ' +
  'flex flex-col items-center gap-2 ' +
  'w-full max-w-sm px-4 ' +
  'pointer-events-none'

const ITEM_BASE_CLASSES =
  'w-full pointer-events-auto ' +
  'flex items-start gap-3 ' +
  'px-4 py-3 ' +
  'rounded-md border shadow-sm ' +
  'text-sm'

const ITEM_TYPE_CLASSES: Record<NotificationType, string> = {
  success:
    'bg-[#dcfce7] border-[#bbf7d0] text-[#166534] dark:bg-[#033a16] dark:border-[#0f5323] dark:text-[#3fb950]',
  error:
    'bg-[#fee2e2] border-[#fecaca] text-[#931F1D] dark:bg-[#3d1513] dark:border-[#5a1d1b] dark:text-[#f85149]',
  info: 'bg-[#dbeafe] border-[#bfdbfe] text-[#1e40af] dark:bg-[#0c2d6b] dark:border-[#1e3a8a] dark:text-[#58a6ff]',
}

const DISMISS_BUTTON_CLASSES =
  'flex-shrink-0 p-0.5 rounded ' +
  'opacity-60 hover:opacity-100 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-current ' +
  'transition-opacity duration-150'

function NotificationItem({
  id,
  type,
  message,
  onDismiss,
}: NotificationItemProps) {
  // Error toasts get role=alert for assertive announcement. Non-error toasts
  // inherit the container's aria-live="polite" region.
  const itemRole = type === 'error' ? 'alert' : undefined

  return (
    <motion.div
      role={itemRole}
      className={ITEM_BASE_CLASSES + ' ' + ITEM_TYPE_CLASSES[type]}
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      layout
    >
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
        className={DISMISS_BUTTON_CLASSES}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </motion.div>
  )
}

function NotificationContainer() {
  const notifications = useTenantStore((state) => state.notifications)
  const dismissNotification = useTenantStore(
    (state) => state.dismissNotification,
  )

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Notifications"
      className={CONTAINER_CLASSES}
    >
      <AnimatePresence>
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            id={notification.id}
            type={notification.type}
            message={notification.message}
            onDismiss={dismissNotification}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

export { NotificationContainer }
export default NotificationContainer
