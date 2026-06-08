import { z } from "zod";

// Mirrors the backend StakeholderDashboardDto (camelCase via the Web JSON
// defaults). Counts are non-negative integers; rates are 0–1 decimals; money
// and avg-hours are plain decimals. Trend arrays are returned gap-filled to
// exactly 12 month buckets by the API.

const monthlyCountSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  count: z.number().int().nonnegative(),
});

const monthlyInviteSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  sent: z.number().int().nonnegative(),
  accepted: z.number().int().nonnegative(),
});

const currencyTotalsSchema = z.object({
  currency: z.string(),
  confirmed: z.number(),
  pending: z.number(),
  outstanding: z.number(),
  overdue: z.number(),
});

const monthlyCurrencyAmountSchema = z.object({
  currency: z.string(),
  year: z.number().int(),
  month: z.number().int(),
  total: z.number(),
});

const growthSectionSchema = z.object({
  totalUsers: z.number().int().nonnegative(),
  landlords: z.number().int().nonnegative(),
  tenants: z.number().int().nonnegative(),
  newUsersThisMonth: z.number().int().nonnegative(),
  userGrowthTrend: z.array(monthlyCountSchema),
});

const adoptionSectionSchema = z.object({
  totalProperties: z.number().int().nonnegative(),
  activeLeases: z.number().int().nonnegative(),
  occupancyRate: z.number().min(0).max(1),
  leasesExpiringSoon: z.number().int().nonnegative(),
  newLeasesThisMonth: z.number().int().nonnegative(),
  leaseGrowthTrend: z.array(monthlyCountSchema),
});

const inviteFunnelSectionSchema = z.object({
  sent: z.number().int().nonnegative(),
  accepted: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  expired: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  acceptanceRate: z.number().min(0).max(1),
  trend: z.array(monthlyInviteSchema),
});

const financialSectionSchema = z.object({
  byCurrency: z.array(currencyTotalsSchema),
  confirmationRate: z.number().min(0).max(1),
  avgHoursToConfirm: z.number(),
  revenueTrend: z.array(monthlyCurrencyAmountSchema),
});

const systemHealthSectionSchema = z.object({
  failedEmailsTotal: z.number().int().nonnegative(),
  failedEmailsThisMonth: z.number().int().nonnegative(),
});

export const stakeholderDashboardSchema = z.object({
  growth: growthSectionSchema,
  adoption: adoptionSectionSchema,
  inviteFunnel: inviteFunnelSectionSchema,
  financial: financialSectionSchema,
  systemHealth: systemHealthSectionSchema,
  generatedAt: z.string(),
});

export type MonthlyCount = z.infer<typeof monthlyCountSchema>;
export type MonthlyInvite = z.infer<typeof monthlyInviteSchema>;
export type CurrencyTotals = z.infer<typeof currencyTotalsSchema>;
export type MonthlyCurrencyAmount = z.infer<typeof monthlyCurrencyAmountSchema>;
export type StakeholderDashboard = z.infer<typeof stakeholderDashboardSchema>;
