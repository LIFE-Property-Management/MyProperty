export const ENDPOINTS = {
  me: "/me",
  tenantAccount: "/tenant/me",
  lease: "/tenant/lease",
  currentPayment: "/tenant/payments/current",
  paymentHistory: "/tenant/payments/history",
  submitReceipt: "/tenant/payments/receipt",
  submitManualRequest: "/tenant/payments/manual-request",
  inviteByToken: (token: string) => `/invites/${encodeURIComponent(token)}`,
  acceptInvite: (token: string) => `/invites/${encodeURIComponent(token)}/accept`,
} as const;

export type EndpointKey = keyof typeof ENDPOINTS;
