// MyProperty — Tenant Portal — Tenant account schema
import { z } from "zod"
import { tenantAccountStatusSchema } from "./enums"

// Represents the authenticated tenant's own account data.
// Validated once on login and stored in Zustand for the session.
export const tenantAccountSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().nullable(), // optional on the account, always present in API response
  // Active = has active lease, full access
  // ReadOnly = post-lease, payment submission disabled. Account is never deleted. See portals.md.
  accountStatus: tenantAccountStatusSchema,
  // Convenience field — used by UI to show/hide payment submission without fetching the lease.
  hasActiveLease: z.boolean(),
  createdAt: z.string().datetime(), // full ISO 8601 datetime ("2024-04-15T10:30:00Z"), unlike .date() which is YYYY-MM-DD only
})

export type TenantAccount = z.infer<typeof tenantAccountSchema>
