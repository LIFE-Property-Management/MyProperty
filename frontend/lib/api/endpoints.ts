export const ENDPOINTS = {
  registerLandlord: "/auth/register-landlord",
  me: "/me",
  tenantAccount: "/tenant/me",
  lease: "/tenant/lease",
  currentPayment: "/tenant/payments/current",
  paymentHistory: "/tenant/payments/history",
  submitReceipt: "/tenant/payments/receipt",
  submitManualRequest: "/tenant/payments/manual-request",
  inviteByToken: (token: string) => `/invites/${encodeURIComponent(token)}`,
  acceptInvite: (token: string) => `/invites/${encodeURIComponent(token)}/accept`,
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
} as const;

export type EndpointKey = keyof typeof ENDPOINTS;
