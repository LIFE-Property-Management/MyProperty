import type { ReactNode } from "react";
import { MockProvider } from "@/mocks/MockProvider";

// The invite-accept route is public — it has no portal KeycloakInit gate (the
// flow detects an optional session itself via useOptionalKeycloak). But it now
// fetches its preview client-side, so it needs the dev MSW worker running here:
// the portal layouts mount MockProvider, and this route sits outside them.
// MockProvider is a no-op passthrough outside development.
export default function InviteLayout({ children }: { children: ReactNode }) {
  return <MockProvider>{children}</MockProvider>;
}
