// Hierarchical array keys: [domain, resource, ...scoping].
// Invalidating queryKeys.tenant.payment.all() invalidates current AND
// history simultaneously — use this when a mutation affects both.

export const queryKeys = {
  tenant: {
    all: ["tenant"] as const,
    account: () => [...queryKeys.tenant.all, "account"] as const,
    lease: () => [...queryKeys.tenant.all, "lease"] as const,
    payment: {
      all: () => [...queryKeys.tenant.all, "payment"] as const,
      current: () => [...queryKeys.tenant.payment.all(), "current"] as const,
      history: (page: number, pageSize: number) =>
        [...queryKeys.tenant.payment.all(), "history", { page, pageSize }] as const,
    },
  },
} as const;
