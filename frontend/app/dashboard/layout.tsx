import type { ReactNode } from "react";
import { DashboardShell } from "./_components/DashboardShell";
import KeycloakInit from "./_components/KeycloakInit";
import { MockProvider } from "@/mocks/MockProvider";

export default function DashboardSegmentLayout({ children }: { children: ReactNode }) {
    return (
        <MockProvider>
            <KeycloakInit />
            <DashboardShell>{children}</DashboardShell>
        </MockProvider>
    );
}
