"use client";

import { useEffect, useState } from "react";
import { initKeycloak } from "@/lib/auth/keycloak";

// Non-gating Keycloak detection for the PUBLIC invite page. Unlike the portal
// KeycloakInit gates (which redirect to /login when there's no session), this
// runs a single check-sso and NEVER redirects: an already-signed-in tenant is
// detected (enabling the authenticated claim path), while anonymous visitors stay
// anonymous (the new-user accept path). It also picks up the session after the
// sign-in round-trip returns to this page.
//
// Resolves `ready` once the check settles either way. A missing Keycloak config
// or a timed-out check-sso is swallowed and treated as anonymous, so the page
// still renders. The dev auth-bypass is intentionally NOT honored here — the
// invite page is primarily an anonymous flow; forcing a fixture identity would
// hide the new-user path. Test the claim path against a real Keycloak session.
export function useOptionalKeycloak(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    initKeycloak()
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return ready;
}
