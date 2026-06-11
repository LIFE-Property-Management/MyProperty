import { z } from "zod";

export const propertyTypeSchema = z.enum(["House", "Apartment", "Commercial", "Other"]);
export type PropertyType = z.infer<typeof propertyTypeSchema>;

export const propertyTenantSchema = z.object({
  // The id of this tenant's lease on the property. Drives the landlord
  // "Cancel lease" action on the detail page (find the row with leaseStatus
  // "Active" → terminate by leaseId).
  leaseId: z.uuid(),
  tenantId: z.uuid(),
  fullName: z.string(),
  email: z.email(),
  leaseStart: z.iso.date(),
  leaseEnd: z.iso.date(),
  monthlyRent: z.number(),
  currency: z.string().length(3),
  leaseStatus: z.string(),
});

export const propertyDetailSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string(),
  unitNumber: z.string().nullable(),
  propertyType: propertyTypeSchema,
  createdAt: z.iso.datetime(),
  // Per-property occupancy (D7). Two bools — precedence: active lease →
  // "Cancel lease"; else pending → "Cancel invitation"; else → "Add lease".
  hasActiveLease: z.boolean(),
  hasPendingInvite: z.boolean(),
  // The property's pending invite id when HasPendingInvite (else null) — drives
  // inline "Cancel invitation". NOTE: the backend returns this treating the
  // property as having a single pending invite. The one-pending-invite-per-
  // property guard rail is NOT yet enforced server-side (a property can still
  // technically have several pending invites; this returns one of them). See
  // PLAN-4-HANDOFF § "Pending backend dependency".
  pendingInviteId: z.uuid().nullable(),
  tenants: z.array(propertyTenantSchema),
});

export type PropertyTenant = z.infer<typeof propertyTenantSchema>;
export type PropertyDetail = z.infer<typeof propertyDetailSchema>;

export const propertyDtoSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string(),
  unitNumber: z.string().nullable(),
  propertyType: propertyTypeSchema,
  createdAt: z.iso.datetime(),
  hasActiveLease: z.boolean(),
  hasPendingInvite: z.boolean(),
  // The Active lease's id when HasActiveLease (else null) — drives "Cancel
  // lease" on the property list without a second round-trip.
  activeLeaseId: z.uuid().nullable(),
  // The pending invite id when HasPendingInvite (else null) — drives "Cancel
  // invitation". Returned as if the property has a single pending invite; the
  // enforcing guard rail is a documented backend TODO (see propertyDetailSchema).
  pendingInviteId: z.uuid().nullable(),
});

export const propertiesResponseSchema = z.object({
  items: z.array(propertyDtoSchema),
  totalCount: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});

export type PropertyDto = z.infer<typeof propertyDtoSchema>;
export type PropertiesResponse = z.infer<typeof propertiesResponseSchema>;
