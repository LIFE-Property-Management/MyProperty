import type { ReactNode } from "react";
import { DashboardShell } from "./_components/DashboardShell";

// TODO Batch K (Keycloak generalization):
// MockProvider and KeycloakInit are NOT wrapped here yet.
// MSW will not intercept landlord API calls and Keycloak will not initialize
// for landlord auth until this layout mirrors the provider-wrapping pattern
// in app/(tenant)/layout.tsx.

export default function DashboardSegmentLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
