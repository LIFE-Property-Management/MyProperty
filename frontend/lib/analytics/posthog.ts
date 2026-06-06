/**
 * PostHog analytics facade (M6.1).
 *
 * This is the ONLY module that touches `posthog-js`. Components and hooks call
 * these typed functions instead of importing posthog directly, which keeps the
 * SDK out of the test surface and centralises the "is analytics even on?" guard.
 *
 * Configuration is env-driven and OPTIONAL — exactly like WebVitalsReporter:
 *   - NEXT_PUBLIC_POSTHOG_KEY   project API key (publishable; safe to inline).
 *   - NEXT_PUBLIC_POSTHOG_HOST  ingestion host (defaults to PostHog EU cloud).
 * When the key is absent (local dev, tests, CI, security scans) every function
 * here is a silent no-op. Drop the key in at build time to turn analytics on —
 * no code change required. Reads are literal `process.env.NEXT_PUBLIC_*`
 * accesses so Next.js inlines them into the client bundle (see lib/utils/env.ts).
 */
import posthog from "posthog-js";
import type { AnalyticsEventName, AnalyticsEventProperties } from "./events";

const POSTHOG_HOST_DEFAULT = "https://eu.i.posthog.com";

let initialized = false;

/** Person properties attached on `identify`. Distinct id is the Keycloak `sub`. */
export interface AnalyticsIdentity {
  portal: "tenant" | "landlord" | "admin";
  email: string;
}

/**
 * Initialise PostHog once, on the client, if a key is configured. Safe to call
 * repeatedly (idempotent) and during SSR (no-ops without `window`).
 */
export function initAnalytics(): void {
  if (initialized) return;
  if (typeof window === "undefined") return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return; // Unconfigured → analytics stays a no-op.

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || POSTHOG_HOST_DEFAULT,
    // App Router does full client-side navigations; we capture $pageview
    // manually on route change (see AnalyticsProvider) instead of relying on
    // the SDK's history-based pageview.
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    persistence: "localStorage+cookie",
    // Only mint person profiles for users we identify (landlords/tenants),
    // not anonymous visitors — leaner data + a lighter GDPR footprint.
    person_profiles: "identified_only",
  });
  initialized = true;
}

/**
 * Properties for an event, or `[]` for events declared with no payload — so
 * `capture("invite_opened")` takes no second arg while
 * `capture("property_created", { propertyType })` requires one.
 */
type CaptureRest<E extends AnalyticsEventName> =
  AnalyticsEventProperties[E] extends Record<string, never>
    ? []
    : [properties: AnalyticsEventProperties[E]];

/** Emit a typed custom event. No-ops until `initAnalytics()` has run with a key. */
export function capture<E extends AnalyticsEventName>(
  event: E,
  ...rest: CaptureRest<E>
): void {
  if (!initialized) return;
  posthog.capture(event, rest[0]);
}

/** Associate subsequent events with a known user (call after auth resolves). */
export function identifyUser(distinctId: string, identity: AnalyticsIdentity): void {
  if (!initialized) return;
  posthog.identify(distinctId, identity);
}

/** Clear the identified user (call on logout) so events aren't cross-attributed. */
export function resetUser(): void {
  if (!initialized) return;
  posthog.reset();
}

/** Capture a manual SPA pageview. `url` should be the absolute URL. */
export function capturePageview(url: string): void {
  if (!initialized) return;
  posthog.capture("$pageview", { $current_url: url });
}

/** Whether PostHog has been initialised with a key in this session. */
export function isAnalyticsEnabled(): boolean {
  return initialized;
}
