"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import useAuthStore from "@/lib/store/auth/useAuthStore";
import {
  capturePageview,
  identifyUser,
  initAnalytics,
  resetUser,
} from "@/lib/analytics";

/**
 * Captures a manual `$pageview` on every App Router navigation. The SDK's
 * automatic pageview is disabled (capture_pageview: false) because soft
 * client-side navigations don't trigger it reliably. `useSearchParams` forces
 * a Suspense boundary, hence the wrapper in AnalyticsProvider.
 */
function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const query = searchParams?.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    capturePageview(`${window.location.origin}${path}`);
  }, [pathname, searchParams]);

  return null;
}

/**
 * Mirrors the auth store into PostHog identity: `identify` on login (keyed by
 * the Keycloak `sub`), `reset` on logout. Lives here at the root so it covers
 * both the landlord and tenant portals without editing either KeycloakInit.
 */
function IdentitySync() {
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user) {
      identifyUser(user.sub, { portal: user.portal, email: user.email });
    } else {
      resetUser();
    }
  }, [user]);

  return null;
}

/**
 * Root-level analytics wiring (M6.1). Initialises PostHog once on mount and
 * mounts the pageview + identity trackers. No-ops entirely when
 * NEXT_PUBLIC_POSTHOG_KEY is unset — see lib/analytics/posthog.ts.
 */
export function AnalyticsProvider() {
  useEffect(() => {
    initAnalytics();
  }, []);

  return (
    <Suspense fallback={null}>
      <PageviewTracker />
      <IdentitySync />
    </Suspense>
  );
}
