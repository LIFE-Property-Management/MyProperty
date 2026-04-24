"use client";

import { NotificationContainer } from "@/components/ui/Notification";
import useTenantStore from "@/lib/store/useTenantStore";

export function TenantNotifications() {
  const notifications = useTenantStore((s) => s.notifications);
  const dismissNotification = useTenantStore((s) => s.dismissNotification);
  return (
    <NotificationContainer
      notifications={notifications}
      onDismiss={dismissNotification}
    />
  );
}
