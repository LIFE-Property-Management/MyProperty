import { z } from "zod";

const isoDateSchema = z.string().date();

export const landlordDashboardSchema = z.object({
  totalProperties: z.number().int().nonnegative(),
  activeLeases: z.number().int().nonnegative(),
  activeTenants: z.number().int().nonnegative(),
  pendingPayments: z.number().int().nonnegative(),
  overduePayments: z.number().int().nonnegative(),
  generatedAt: z.string(),
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

export const upcomingPaymentsResponseSchema = z.object({
  items: z.array(upcomingPaymentRowSchema),
  totalCount: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export type UpcomingPaymentRow = z.infer<typeof upcomingPaymentRowSchema>;
export type LandlordDashboard = z.infer<typeof landlordDashboardSchema>;
export type UpcomingPaymentsResponse = z.infer<typeof upcomingPaymentsResponseSchema>;
