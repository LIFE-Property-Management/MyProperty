// MyProperty — Tenant Portal — Lease schemas
import { z } from "zod"
import { leaseStatusSchema } from "./enums"

// Represents the lease summary card shown on the tenant dashboard.
// This is a read model — data comes from the API, never written directly by the tenant.
// Mirrors the backend TenantLeaseDto (GET /tenant/lease) field-for-field. The
// backend does NOT return a propertyId (no tenant property-detail route consumes
// one), so it is intentionally absent here.
export const leaseSummarySchema = z.object({
  id: z.string().uuid(),
  propertyName: z.string().min(1),
  propertyAddress: z.string().min(1),
  unitNumber: z.string().nullable(),
  landlordName: z.string().min(1),
  startDate: z.string().date(), // YYYY-MM-DD (backend DateOnly)
  endDate: z.string().date(), // YYYY-MM-DD (backend DateOnly)
  monthlyRent: z.number().positive(),
  currency: z.string().length(3), // ISO 4217 code e.g. "EUR"
  status: leaseStatusSchema,
})

export type LeaseSummary = z.infer<typeof leaseSummarySchema>
