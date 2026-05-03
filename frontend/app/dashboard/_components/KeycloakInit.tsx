"use client";

import { useEffect } from "react";
import { initKeycloak } from "@/lib/auth/keycloak";
import useAuthStore from "@/lib/store/auth/useAuthStore";

// Landlord-portal KeycloakInit. Kept separate from the tenant version
// (app/(tenant)/_components/KeycloakInit.tsx) so each portal can diverge
// independently when real Keycloak roles are wired per Decision 5 (Batch K).
export default function KeycloakInit() {
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

    if (isDevAuthBypass) {
      useAuthStore.getState().setAuth({
        portal: "landlord",
        sub: "dev-landlord",
        email: "landlord@dev.local",
      });
      return;
    }

    initKeycloak();
  }, []);

  return null;
}
