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
  landlord: {
    all: ["landlord"] as const,
    dashboard: () => [...queryKeys.landlord.all, "dashboard"] as const,
    payment: {
      all: () => [...queryKeys.landlord.all, "payment"] as const,
      upcoming: (page: number, pageSize: number) =>
        [...queryKeys.landlord.payment.all(), "upcoming", { page, pageSize }] as const,
    },
    property: {
      all: () => [...queryKeys.landlord.all, "property"] as const,
      list: (page: number, pageSize: number) =>
        [...queryKeys.landlord.property.all(), "list", { page, pageSize }] as const,
      detail: (id: string) => [...queryKeys.landlord.property.all(), "detail", id] as const,
    },
  },
} as const;
