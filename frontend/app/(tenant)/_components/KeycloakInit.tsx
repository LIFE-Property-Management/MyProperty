"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { initKeycloak } from "@/lib/auth/keycloak";
import useAuthStore from "@/lib/store/auth/useAuthStore";

// Tenant-portal auth gate. Kept separate from the landlord version
// (app/dashboard/_components/KeycloakInit.tsx) so each portal can diverge
// independently when real Keycloak roles are wired per Decision 5 (Batch K).
//
// Acts as a render gate: children (the portal) are not shown until Keycloak
// init resolves. If there is no authenticated session, the user is redirected
// to /login rather than being left on a portal that would only produce 401s.
// This keeps the client authoritative; the middleware cookie is just a coarse
// edge gate.
export default function KeycloakInit({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Dev-only auth bypass. When NEXT_PUBLIC_DEV_AUTH_BYPASS is "true",
    // KeycloakInit short-circuits Keycloak initialization and signs the user
    // in as a fixture identity. Useful for local UI work without a running
    // Keycloak. Must be off (unset or "false") in any deployed environment.
    const isDevAuthBypass = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";

    if (isDevAuthBypass && process.env.NODE_ENV === "production") {
      console.warn(
        "[KeycloakInit] NEXT_PUBLIC_DEV_AUTH_BYPASS is enabled in a production " +
        "build. This bypasses authentication and is unsafe outside local dev."
      );
    }

    let active = true;
    const settled = isDevAuthBypass
      ? Promise.resolve().then(() => {
          useAuthStore.getState().setAuth({
            portal: "tenant",
            sub: "dev-tenant",
            email: "tenant@dev.local",
          });
        })
      : initKeycloak();

    settled.finally(() => {
      if (!active) return;
      if (!useAuthStore.getState().user) {
        router.replace("/login");
        return;
      }
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-text" role="status">
          Loading…
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
