import type { ReactNode } from "react";
import KeycloakInit from "./_components/KeycloakInit";
import { NotificationContainer } from "./_components/ui/Notification";
import { PaymentSubmissionModal } from "./_components/PaymentSubmissionModal";
import { MockProvider } from "@/mocks/MockProvider";

export default function TenantLayout({ children }: { children: ReactNode }) {
  return (
    <MockProvider>
      <KeycloakInit />
      {children}
      <NotificationContainer />
      <PaymentSubmissionModal />
    </MockProvider>
  );
}
