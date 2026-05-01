import { z } from "zod";
import { paymentMethodSchema } from "@/lib/types/enums";

const isoDateSchema = z.string().date();

export const landlordStatsSchema = z.object({
  totalProperties: z.number().int().nonnegative(),
  totalActiveTenants: z.number().int().nonnegative(),
});

export const overduePaymentRowSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  tenantName: z.string(),
  property: z.string(),
  amount: z.number(),
  currency: z.string().length(3),
  daysOverdue: z.number().int().positive(),
});

export const expiringLeaseRowSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  tenantName: z.string(),
  property: z.string(),
  leaseEndDate: isoDateSchema,
  daysRemaining: z.number().int().positive(),
});

export const recentPaymentRowSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  tenantName: z.string(),
  property: z.string(),
  amount: z.number(),
  currency: z.string().length(3),
  method: paymentMethodSchema,
  datePaid: isoDateSchema,
});

export const upcomingPaymentRowSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  tenantName: z.string(),
  property: z.string(),
  amount: z.number(),
  currency: z.string().length(3),
  dueDate: isoDateSchema,
});

export const landlordDashboardSchema = z.object({
  stats: landlordStatsSchema,
  overduePayments: z.array(overduePaymentRowSchema),
  expiringLeases: z.array(expiringLeaseRowSchema),
  recentPayments: z.array(recentPaymentRowSchema).max(5),
});

export const upcomingPaymentsResponseSchema = z.object({
  items: z.array(upcomingPaymentRowSchema),
  totalCount: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export type LandlordStats = z.infer<typeof landlordStatsSchema>;
export type OverduePaymentRow = z.infer<typeof overduePaymentRowSchema>;
export type ExpiringLeaseRow = z.infer<typeof expiringLeaseRowSchema>;
export type RecentPaymentRow = z.infer<typeof recentPaymentRowSchema>;
export type UpcomingPaymentRow = z.infer<typeof upcomingPaymentRowSchema>;
export type LandlordDashboard = z.infer<typeof landlordDashboardSchema>;
export type UpcomingPaymentsResponse = z.infer<typeof upcomingPaymentsResponseSchema>;
