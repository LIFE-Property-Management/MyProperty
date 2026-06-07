import type { ReactNode } from "react";
import { AdminShell } from "./_components/AdminShell";
import KeycloakInit from "./_components/KeycloakInit";
import { MockProvider } from "@/mocks/MockProvider";

export default function AdminSegmentLayout({ children }: { children: ReactNode }) {
    return (
        <MockProvider>
            <KeycloakInit>
                <AdminShell>{children}</AdminShell>
            </KeycloakInit>
        </MockProvider>
    );
}
