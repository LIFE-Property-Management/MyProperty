"use client";

export type NotificationType = "success" | "error" | "info";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  message: string;
}

export interface NotificationContainerProps {
  notifications: NotificationItem[];
  onDismiss: (id: string) => void;
}

interface NotificationItemViewProps {
  id: string;
  type: NotificationType;
  message: string;
  onDismiss: (id: string) => void;
}

const CONTAINER_CLASSES =
  "fixed top-4 left-1/2 -translate-x-1/2 z-[60] " +
  "flex flex-col items-center gap-2 " +
  "w-full max-w-sm px-4 " +
  "pointer-events-none";

const ITEM_BASE_CLASSES =
  "w-full pointer-events-auto " +
  "flex items-start gap-3 " +
  "px-4 py-3 " +
  "rounded-md border shadow-sm " +
  "text-sm " +
  "animate-toast-enter";

const ITEM_TYPE_CLASSES: Record<NotificationType, string> = {
  success: "bg-success-light border-success/30 text-success",
  error: "bg-danger-light border-danger/30 text-danger",
  info: "bg-info-light border-info/30 text-info",
};

const DISMISS_BUTTON_CLASSES =
  "flex-shrink-0 p-0.5 rounded " +
  "opacity-60 hover:opacity-100 " +
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-current " +
  "transition-opacity duration-150";

function NotificationItemView({
  id,
  type,
  message,
  onDismiss,
}: NotificationItemViewProps) {
  const itemRole = type === "error" ? "alert" : undefined;

  return (
    <div
      role={itemRole}
      className={ITEM_BASE_CLASSES + " " + ITEM_TYPE_CLASSES[type]}
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
    </div>
  );
}

function NotificationContainer({
  notifications,
  onDismiss,
}: NotificationContainerProps) {
  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Notifications"
      className={CONTAINER_CLASSES}
    >
      {notifications.map((n) => (
        <NotificationItemView
          key={n.id}
          id={n.id}
          type={n.type}
          message={n.message}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}

export { NotificationContainer };
export default NotificationContainer;
