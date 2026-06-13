// MyProperty — Real-time (SignalR) event contract.
//
// The backend NotificationsHub pushes the events below to role-scoped groups
// (tenant:{id} / landlord:{id}). The wire method names here must match the
// server's SignalRNotificationDispatcher exactly — renaming either side breaks
// delivery silently. See backend/MyProperty.Api/Hubs/SignalRNotificationDispatcher.cs.
//
// Per the SignalR/TanStack contract (frontend/CLAUDE.md), a received event is a
// SIGNAL, not data: the client never reads the payload as canonical state. It
// only invalidates the relevant TanStack Query keys so the cache refetches
// authoritative data from the REST API.

import type { QueryKey } from "@tanstack/react-query";
import { queryKeys } from "@/lib/hooks/queryKeys";

export const HUB_EVENTS = {
  paymentConfirmed: "PaymentConfirmed",
  paymentRejected: "PaymentRejected",
  paymentCreated: "PaymentCreated",
  paymentSubmitted: "PaymentSubmitted",
  leaseExpiringSoon: "LeaseExpiringSoon",
  inviteAccepted: "InviteAccepted",
  inviteRejected: "InviteRejected",
} as const;

export type HubEventName = (typeof HUB_EVENTS)[keyof typeof HUB_EVENTS];

// The hub assigns each connection to exactly one role group, so a browser only
// ever receives the events for its own portal. Admin connections get no group
// (the server aborts them on connect), so there is no admin entry here.
export type HubPortal = "tenant" | "landlord";

// Maps each event a portal can receive to the query keys to invalidate.
//
// LeaseExpiringSoon is sent to BOTH portals with the same payload but lands on
// different cached views, which is why the mapping is portal-specific rather
// than a single flat table. Keys are recomputed per call (queryKeys factories
// return fresh arrays) — cheap, and keeps this a pure function with no shared
// mutable state.
export function invalidationKeysFor(
  portal: HubPortal,
): Partial<Record<HubEventName, QueryKey[]>> {
  if (portal === "tenant") {
    return {
      // Status of an existing payment changed, or a new charge was raised —
      // both the "current payment" and history views can be affected.
      [HUB_EVENTS.paymentConfirmed]: [queryKeys.tenant.payment.all()],
      [HUB_EVENTS.paymentRejected]: [queryKeys.tenant.payment.all()],
      [HUB_EVENTS.paymentCreated]: [queryKeys.tenant.payment.all()],
      // Lease nearing expiry — refresh the lease summary.
      [HUB_EVENTS.leaseExpiringSoon]: [queryKeys.tenant.lease()],
    };
  }

  return {
    // A tenant submitted a payment for review: the upcoming/pending list, the
    // dashboard counts, and the tenant-detail payment history all move.
    [HUB_EVENTS.paymentSubmitted]: [
      queryKeys.landlord.payment.all(),
      queryKeys.landlord.dashboard(),
      queryKeys.landlord.tenant.all(),
    ],
    // A lease the landlord owns is expiring soon — surfaced on the dashboard
    // and the tenant detail page.
    [HUB_EVENTS.leaseExpiringSoon]: [
      queryKeys.landlord.dashboard(),
      queryKeys.landlord.tenant.all(),
    ],
    // Invite accepted creates a lease + tenant and flips a property's occupancy
    // (Vacant/Invite-pending → Leased), so tenants, properties, and the
    // dashboard all change — and the invite itself flips to Accepted on the
    // landlord's Invites list, so refresh that too.
    [HUB_EVENTS.inviteAccepted]: [
      queryKeys.landlord.tenant.all(),
      queryKeys.landlord.property.all(),
      queryKeys.landlord.dashboard(),
      queryKeys.landlord.invites.all(),
    ],
    // Invite rejected clears a property's pending-invite badge; no lease is
    // created, so property occupancy and the dashboard need a refresh — plus
    // the invite flips to Rejected on the landlord's Invites list.
    [HUB_EVENTS.inviteRejected]: [
      queryKeys.landlord.property.all(),
      queryKeys.landlord.dashboard(),
      queryKeys.landlord.invites.all(),
    ],
  };
}
