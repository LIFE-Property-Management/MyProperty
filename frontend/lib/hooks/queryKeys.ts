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
  admin: {
    all: ["admin"] as const,
    dashboard: () => [...queryKeys.admin.all, "dashboard"] as const,
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
    invites: {
      all: () => [...queryKeys.landlord.all, "invites"] as const,
      list: (page: number, pageSize: number, status?: string) =>
        [
          ...queryKeys.landlord.invites.all(),
          "list",
          { page, pageSize, status: status ?? null },
        ] as const,
    },
    tenant: {
      all: () => [...queryKeys.landlord.all, "tenant"] as const,
      list: (page: number, pageSize: number) =>
        [...queryKeys.landlord.tenant.all(), "list", { page, pageSize }] as const,
      detail: (id: string) => [...queryKeys.landlord.tenant.all(), "detail", id] as const,
    },
  },
} as const;
