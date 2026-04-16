import type { ReactNode } from "react";
import KeycloakInit from "./_components/KeycloakInit";

export default function TenantLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <KeycloakInit />
      {children}
    </>
  );
}
