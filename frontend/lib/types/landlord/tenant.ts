import { z } from "zod";
import { leaseStatusSchema, paymentStatusSchema } from "@/lib/types/enums";

export const landlordTenantRowSchema = z.object({
  tenantId: z.uuid(),
  email: z.email(),
  firstName: z.string(),
  lastName: z.string(),
  propertyName: z.string(),
  leaseStatus: leaseStatusSchema,
  leaseEndDate: z.iso.date(),
});

export const tenantsResponseSchema = z.object({
  items: z.array(landlordTenantRowSchema),
  totalCount: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});

export const paymentHistoryItemSchema = z.object({
  id: z.uuid(),
  amount: z.number(),
  currency: z.string().length(3),
  dueDate: z.iso.date(),
  status: paymentStatusSchema,
  submittedAt: z.iso.datetime().nullable(),
  confirmedAt: z.iso.datetime().nullable(),
  rejectedAt: z.iso.datetime().nullable(),
});

export const tenantDetailSchema = z.object({
  tenantId: z.uuid(),
  email: z.email(),
  fullName: z.string(),
  propertyName: z.string(),
  leaseId: z.uuid(),
  leaseStartDate: z.iso.date(),
  leaseEndDate: z.iso.date(),
  monthlyRent: z.number(),
  currency: z.string().length(3),
  leaseStatus: leaseStatusSchema,
  paymentHistory: z.array(paymentHistoryItemSchema),
});

export type LandlordTenantRow = z.infer<typeof landlordTenantRowSchema>;
export type TenantsResponse = z.infer<typeof tenantsResponseSchema>;
export type PaymentHistoryItem = z.infer<typeof paymentHistoryItemSchema>;
export type TenantDetail = z.infer<typeof tenantDetailSchema>;
