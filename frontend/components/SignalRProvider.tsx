"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import useAuthStore from "@/lib/store/auth/useAuthStore";
import { getAccessToken } from "@/lib/auth/keycloak";
import { requirePublicEnv } from "@/lib/utils/env";
import { buildHubConnection, NOTIFICATIONS_HUB_PATH } from "@/lib/realtime/connection";
import { invalidationKeysFor } from "@/lib/realtime/events";

/**
 * Root-level SignalR wiring (the frontend half of M3.6 real-time).
 *
 * Owns a single notifications-hub connection per authenticated session: it
 * opens when a tenant/landlord signs in and tears down on logout or portal
 * switch (the effect re-runs when `portal` changes). The hub is server-push
 * only — this provider never sends; on each received event it invalidates the
 * relevant TanStack Query keys so the cache refetches authoritative data from
 * the REST API. SignalR payloads are signals, never stored as state.
 *
 * Renders nothing — it's an effect host mounted inside the QueryClientProvider
 * (see components/Providers.tsx), not a context provider. Mounting it there is
 * what gives it the `useQueryClient()` it needs and keeps the connection's
 * lifecycle anchored at the app root rather than in any one portal.
 */
export function SignalRProvider() {
  const queryClient = useQueryClient();
  const portal = useAuthStore((s) => s.user?.portal);

  useEffect(() => {
    // Connect only for the two portals the hub assigns groups to. Admin
    // connections get no group server-side and are aborted on connect, so
    // there is nothing to subscribe to.
    if (portal !== "tenant" && portal !== "landlord") return;

    // The dev-auth bypass has no real Keycloak token to authenticate the
    // handshake. Skip entirely rather than loop on failed reconnects.
    if (process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true") return;

    // An unset API base means there is no real backend to reach — the MSW dev
    // setup intercepts relative REST URLs but cannot serve a WebSocket hub. Skip
    // so dev/test runs don't thrash against a hub that isn't there. In prod the
    // base is always set (requirePublicEnv throws at build otherwise).
    const apiBase = requirePublicEnv("NEXT_PUBLIC_API_BASE_URL");
    if (apiBase === "") return;

    const connection = buildHubConnection(
      `${apiBase}${NOTIFICATIONS_HUB_PATH}`,
      getAccessToken,
    );

    const keysByEvent = invalidationKeysFor(portal);
    for (const [event, keys] of Object.entries(keysByEvent)) {
      connection.on(event, () => {
        for (const queryKey of keys) {
          queryClient.invalidateQueries({ queryKey });
        }
      });
    }

    // `disposed` guards the cleanup race: in React StrictMode (dev) and on fast
    // login/logout, the effect can tear down before start()'s promise settles.
    // We swallow the start rejection in that window so it doesn't surface as an
    // unhandled error, and stop() is fire-and-forget.
    let disposed = false;
    connection.start().catch((err) => {
      if (!disposed) {
        console.warn(
          "[SignalR] Could not open the notifications connection; " +
            "real-time updates are unavailable this session.",
          err,
        );
      }
    });

    return () => {
      disposed = true;
      connection.stop().catch(() => {});
    };
  }, [portal, queryClient]);

  return null;
}
