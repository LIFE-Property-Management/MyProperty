// MyProperty — Tenant Portal — Lease schemas
import { z } from "zod"
import { leaseStatusSchema } from "./enums"

// Represents the lease summary card shown on the tenant dashboard.
// This is a read model — data comes from the API, never written directly by the tenant.
export const leaseSummarySchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid(),
  propertyName: z.string().min(1),
  propertyAddress: z.string().min(1),
  unitNumber: z.string().nullable(),
  landlordName: z.string().min(1),
  startDate: z.string().date(), // YYYY-MM-DD
  endDate: z.string().date(), // YYYY-MM-DD
  monthlyRent: z.number().positive(),
  currency: z.string().length(3), // ISO 4217 code e.g. "EUR"
  status: leaseStatusSchema,
})

export type LeaseSummary = z.infer<typeof leaseSummarySchema>
