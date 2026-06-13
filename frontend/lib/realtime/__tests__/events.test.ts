import { HUB_EVENTS, invalidationKeysFor } from "../events";
import { queryKeys } from "@/lib/hooks/queryKeys";

// The event→query-key map is the contract between server pushes and cache
// invalidation. These tests pin the mapping so a careless edit (e.g. dropping
// the dashboard refresh from a payment event) fails loudly.

describe("invalidationKeysFor — tenant", () => {
  const map = invalidationKeysFor("tenant");

  it("maps every payment event to the tenant payment cache", () => {
    expect(map[HUB_EVENTS.paymentConfirmed]).toEqual([queryKeys.tenant.payment.all()]);
    expect(map[HUB_EVENTS.paymentRejected]).toEqual([queryKeys.tenant.payment.all()]);
    expect(map[HUB_EVENTS.paymentCreated]).toEqual([queryKeys.tenant.payment.all()]);
  });

  it("maps LeaseExpiringSoon to the tenant lease cache", () => {
    expect(map[HUB_EVENTS.leaseExpiringSoon]).toEqual([queryKeys.tenant.lease()]);
  });

  it("does not subscribe to landlord-only events", () => {
    expect(map[HUB_EVENTS.paymentSubmitted]).toBeUndefined();
    expect(map[HUB_EVENTS.inviteAccepted]).toBeUndefined();
    expect(map[HUB_EVENTS.inviteRejected]).toBeUndefined();
  });
});

describe("invalidationKeysFor — landlord", () => {
  const map = invalidationKeysFor("landlord");

  it("refreshes payments, dashboard, and tenants on PaymentSubmitted", () => {
    expect(map[HUB_EVENTS.paymentSubmitted]).toEqual([
      queryKeys.landlord.payment.all(),
      queryKeys.landlord.dashboard(),
      queryKeys.landlord.tenant.all(),
    ]);
  });

  it("refreshes dashboard and tenants on LeaseExpiringSoon", () => {
    expect(map[HUB_EVENTS.leaseExpiringSoon]).toEqual([
      queryKeys.landlord.dashboard(),
      queryKeys.landlord.tenant.all(),
    ]);
  });

  it("refreshes tenants, properties, dashboard, and the invites list on InviteAccepted", () => {
    expect(map[HUB_EVENTS.inviteAccepted]).toEqual([
      queryKeys.landlord.tenant.all(),
      queryKeys.landlord.property.all(),
      queryKeys.landlord.dashboard(),
      queryKeys.landlord.invites.all(),
    ]);
  });

  it("refreshes properties, dashboard, and the invites list on InviteRejected", () => {
    expect(map[HUB_EVENTS.inviteRejected]).toEqual([
      queryKeys.landlord.property.all(),
      queryKeys.landlord.dashboard(),
      queryKeys.landlord.invites.all(),
    ]);
  });

  it("does not subscribe to tenant-only payment events", () => {
    expect(map[HUB_EVENTS.paymentConfirmed]).toBeUndefined();
    expect(map[HUB_EVENTS.paymentRejected]).toBeUndefined();
    expect(map[HUB_EVENTS.paymentCreated]).toBeUndefined();
  });
});
