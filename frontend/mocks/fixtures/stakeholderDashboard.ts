import {
  stakeholderDashboardSchema,
  type MonthlyCount,
  type MonthlyInvite,
  type MonthlyCurrencyAmount,
  type StakeholderDashboard,
} from "@/lib/types/admin/dashboard";

// Twelve contiguous month buckets ending at a fixed anchor (keeps the dev
// fixture deterministic; the real API anchors to the current month).
const ANCHOR_YEAR = 2026;
const ANCHOR_MONTH = 6; // June 2026

function lastTwelveMonths(): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    // Month index relative to the anchor, normalized into year/month.
    const zeroBased = ANCHOR_MONTH - 1 - i;
    const year = ANCHOR_YEAR + Math.floor(zeroBased / 12);
    const month = ((zeroBased % 12) + 12) % 12 + 1;
    out.push({ year, month });
  }
  return out;
}

const months = lastTwelveMonths();

const userGrowthTrend: MonthlyCount[] = months.map((m, i) => ({
  ...m,
  count: [4, 6, 5, 8, 7, 10, 9, 12, 11, 14, 13, 16][i],
}));

const leaseGrowthTrend: MonthlyCount[] = months.map((m, i) => ({
  ...m,
  count: [2, 3, 3, 5, 4, 6, 5, 7, 6, 8, 7, 9][i],
}));

const inviteTrend: MonthlyInvite[] = months.map((m, i) => ({
  ...m,
  sent: [5, 7, 6, 9, 8, 11, 10, 13, 12, 15, 14, 17][i],
  accepted: [3, 4, 4, 6, 5, 7, 6, 9, 8, 10, 9, 12][i],
}));

const revenueTrend: MonthlyCurrencyAmount[] = months.flatMap((m, i) => [
  { currency: "EUR", ...m, total: [3200, 3500, 3400, 4100, 4000, 4600, 4500, 5200, 5100, 5800, 5700, 6400][i] },
  { currency: "USD", ...m, total: [1200, 1300, 1250, 1500, 1450, 1700, 1650, 1900, 1850, 2100, 2050, 2300][i] },
]);

export const stakeholderDashboardFixture: StakeholderDashboard = {
  growth: {
    totalUsers: 142,
    landlords: 38,
    tenants: 96,
    newUsersThisMonth: 16,
    userGrowthTrend,
  },
  adoption: {
    totalProperties: 64,
    activeLeases: 51,
    occupancyRate: 0.7969,
    leasesExpiringSoon: 5,
    newLeasesThisMonth: 9,
    leaseGrowthTrend,
  },
  inviteFunnel: {
    sent: 137,
    accepted: 89,
    rejected: 12,
    expired: 21,
    pending: 15,
    acceptanceRate: 0.6496,
    trend: inviteTrend,
  },
  financial: {
    byCurrency: [
      { currency: "EUR", confirmed: 58200, pending: 4100, outstanding: 2600, overdue: 900 },
      { currency: "USD", confirmed: 21300, pending: 1500, outstanding: 1100, overdue: 300 },
    ],
    confirmationRate: 0.9123,
    avgHoursToConfirm: 18.5,
    revenueTrend,
  },
  systemHealth: {
    failedEmailsTotal: 7,
    failedEmailsThisMonth: 1,
  },
  generatedAt: "2026-06-07T10:00:00Z",
};

stakeholderDashboardSchema.parse(stakeholderDashboardFixture);
