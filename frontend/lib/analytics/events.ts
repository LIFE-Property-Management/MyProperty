/**
 * Analytics event taxonomy (M6.1) — the single source of truth for every
 * custom event MyProperty emits to PostHog.
 *
 * Conventions:
 *   - Event names are snake_case. Use past-tense verbs for completed actions
 *     (`property_created`) and `*_started` for funnel-entry intents
 *     (`signup_started`).
 *   - Names are a wire contract: renaming an event orphans its historical data
 *     in PostHog. Add new events; do not rename shipped ones.
 *   - Every event listed here must have a payload contract in
 *     `AnalyticsEventProperties` below — `capture()` won't compile otherwise.
 *
 * Funnels these events power (built in the PostHog UI — see
 * docs/milestones/m6-product-analytics.md):
 *   ★ Landlord activation (headline): signup_started → signup_completed →
 *     property_created → tenant_invite_started (→ tenant_invited)
 *   · Tenant onboarding: invite_opened → lease_reviewed → invite_accepted
 *   · Payment collection: payment_submission_started →
 *     payment_receipt_submitted | payment_manual_request_submitted
 */
export const ANALYTICS_EVENTS = {
  // ── Landlord activation funnel (headline) ──────────────────────────────
  signupStarted: "signup_started",
  signupCompleted: "signup_completed",
  propertyCreated: "property_created",
  tenantInviteStarted: "tenant_invite_started",
  /**
   * Fires when a landlord actually creates/sends an invite — the final step
   * (step 6) of the landlord activation funnel.
   *
   * Wired (Plan 4): emitted from `useCreateInvite`'s `onSuccess`
   * (`lib/hooks/useCreateInvite.ts`), driven by the create-invite flow at
   * `app/dashboard/invites/new`. The preceding intent step,
   * `tenant_invite_started`, fires from the "Add lease" property action.
   */
  tenantInvited: "tenant_invited",

  // ── Tenant onboarding funnel ───────────────────────────────────────────
  inviteOpened: "invite_opened",
  leaseReviewed: "lease_reviewed",
  inviteAccepted: "invite_accepted",

  // ── Payment-collection funnel ──────────────────────────────────────────
  paymentSubmissionStarted: "payment_submission_started",
  paymentReceiptSubmitted: "payment_receipt_submitted",
  paymentManualRequestSubmitted: "payment_manual_request_submitted",
} as const;

/** Union of the wire event names (the string VALUES of `ANALYTICS_EVENTS`). */
export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/** Marker for events that carry no properties. */
type NoProperties = Record<string, never>;

/**
 * Per-event property contracts, keyed by the wire event name. `capture()` uses
 * this map to enforce the correct payload shape at each call site.
 *
 * Coverage is checked at compile time: `capture<E>` indexes this map by the
 * full `AnalyticsEventName` union, so omitting any event name here is a type
 * error in `posthog.ts`.
 */
export interface AnalyticsEventProperties {
  signup_started: NoProperties;
  signup_completed: { method: "email" };
  property_created: { propertyType: string };
  tenant_invite_started: { propertyId: string };
  tenant_invited: { propertyId: string };
  invite_opened: NoProperties;
  lease_reviewed: NoProperties;
  invite_accepted: NoProperties;
  payment_submission_started: { method: "receiptUpload" | "manualRequest" };
  payment_receipt_submitted: NoProperties;
  payment_manual_request_submitted: NoProperties;
}
