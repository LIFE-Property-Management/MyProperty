"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { initKeycloak } from "@/lib/auth/keycloak";
import useAuthStore from "@/lib/store/auth/useAuthStore";

// Admin-portal auth gate. Kept separate from the landlord/tenant versions
// (app/dashboard/_components/KeycloakInit.tsx, app/(tenant)/_components/KeycloakInit.tsx)
// so each portal can diverge independently.
//
// Acts as a render gate: children (the portal shell) are not shown until
// Keycloak init resolves. Beyond requiring a session, this gate also enforces
// that the session is an ADMIN portal — a landlord/tenant who reaches /admin is
// bounced to /login. The API stays the real authority (a non-admin token gets a
// 403 from /api/v1/admin/*); this is just so the UI never half-renders for the
// wrong role.
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
            portal: "admin",
            sub: "dev-admin",
            email: "admin@dev.local",
          });
        })
      : initKeycloak();

    settled.finally(() => {
      if (!active) return;
      const user = useAuthStore.getState().user;
      if (!user || user.portal !== "admin") {
        // No session, or a non-admin portal reached /admin — bounce to login.
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
