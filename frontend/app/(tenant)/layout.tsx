import type { ReactNode } from "react";
import KeycloakInit from "./_components/KeycloakInit";
import { TenantNotifications } from "./_components/TenantNotifications";
import { PaymentSubmissionModal } from "./_components/PaymentSubmissionModal";
import { MockProvider } from "@/mocks/MockProvider";

export default function TenantLayout({ children }: { children: ReactNode }) {
  return (
    <MockProvider>
      <KeycloakInit />
      {children}
      <TenantNotifications />
      <PaymentSubmissionModal />
    </MockProvider>
  );
}
