"use client";

import { useEffect } from "react";
import { initKeycloak } from "@/lib/auth/keycloak";
import useAuthStore from "@/lib/store/auth/useAuthStore";

export default function KeycloakInit() {
  useEffect(() => {
    // When Keycloak isn't configured (e.g. E2E in CI), seed a mock tenant so
    // the app renders without redirecting. MSW handles all API calls in dev mode.
    if (
      process.env.NODE_ENV === "development" &&
      !process.env.NEXT_PUBLIC_KEYCLOAK_URL
    ) {
      useAuthStore
        .getState()
        .setAuth({ portal: "tenant", sub: "dev-tenant", email: "tenant@dev.local" });
      return;
    }
    initKeycloak();
  }, []);

  return null;
}
