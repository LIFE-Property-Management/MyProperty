export const ENDPOINTS = {
  registerLandlord: "/auth/register-landlord",
  // Identity + lazy User-row upsert. Backend kept tenant identity here (MeDto:
  // { …, accountStatus, roles }); the tenant lease read moved to /tenant/lease.
  // There is NO /tenant/me route (only a /me/tenant-only policy echo).
  me: "/me",
  lease: "/tenant/lease",
  // Tenant self-service lease cancellation. POST, no body (tenant from JWT) →
  // 204; backend terminates the active lease and emails the landlord. 404 when
  // no active lease, 409 when already terminated. Mirrors TenantController.
  cancelLease: "/tenant/lease/cancel",
  currentPayment: "/tenant/payments/current",
  paymentHistory: "/tenant/payments/history",
  submitReceipt: "/tenant/payments/receipt",
  submitManualRequest: "/tenant/payments/manual-request",
  // Anonymous invite preview. Backend route is /invites/by-token/{token} —
  // returns 200 for ANY resolved invite WITH its real status, 404 only for an
  // unknown token-hash. Mirrors InvitesController.GetByToken.
  inviteByToken: (token: string) => `/invites/by-token/${encodeURIComponent(token)}`,
  // Anonymous new-user accept (carries password). Returning, authenticated
  // tenants use claimInvite instead (no body — identity from the JWT).
  acceptInvite: (token: string) => `/invites/${encodeURIComponent(token)}/accept`,
  claimInvite: (token: string) => `/invites/${encodeURIComponent(token)}/claim`,
  landlordDashboard: "/landlord/dashboard",
  landlordUpcomingPayments: "/landlord/payments/upcoming",
  // Landlord payment-confirmation actions. Mirror the backend routes
  // POST /payments/{id}/confirm and POST /payments/{id}/reject (prefix-less
  // here; client.ts prepends /api/v1 for real deploys).
  confirmPayment: (id: string) => `/payments/${encodeURIComponent(id)}/confirm`,
  rejectPayment: (id: string) => `/payments/${encodeURIComponent(id)}/reject`,
  properties: "/properties",
  propertyById: (id: string) => `/properties/${encodeURIComponent(id)}`,
  landlordTenants: "/landlord/tenants",
  landlordTenantById: (id: string) => `/landlord/tenants/${encodeURIComponent(id)}`,
  adminDashboard: "/admin/dashboard",
  // Landlord invite management. GET (list) + POST (create) share /invites;
  // revoke/resend are keyed by the invite Guid. Mirrors InvitesController.
  landlordInvites: "/invites",
  revokeInvite: (id: string) => `/invites/${encodeURIComponent(id)}/revoke`,
  resendInvite: (id: string) => `/invites/${encodeURIComponent(id)}/resend`,
  // Landlord terminates a lease (PATCH /leases/{id}/terminate).
  terminateLease: (id: string) => `/leases/${encodeURIComponent(id)}/terminate`,
} as const;

export type EndpointKey = keyof typeof ENDPOINTS;
