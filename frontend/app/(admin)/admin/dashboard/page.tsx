"use client";

import Spinner from "@/components/ui/Spinner";
import { useStakeholderDashboard } from "@/lib/hooks";
import { KpiCard } from "./_components/KpiCard";
import { TrendChart } from "./_components/TrendChart";

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// "Jan 26" — compact label for the line charts (non-technical audience).
function monthLabel(year: number, month: number): string {
  const abbr = MONTH_ABBR[month - 1] ?? String(month);
  return `${abbr} ${String(year).slice(-2)}`;
}

function formatPercent(rate: number): string {
  // Exact zero (e.g. the divide-by-zero guards return 0 on an empty platform)
  // reads cleaner as "0%" than "0.0%". Non-zero rates keep one decimal.
  if (rate === 0) return "0%";
  return `${(rate * 100).toFixed(1)}%`;
}

function formatHours(hours: number): string {
  // Exact zero (no confirmed payments yet) reads cleaner as "0 h" than "0.0 h".
  if (hours === 0) return "0 h";
  return `${hours.toFixed(1)} h`;
}

function formatMoney(currency: string, amount: number): string {
  return `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function AdminDashboardPage() {
  const { data, isLoading, isError } = useStakeholderDashboard();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-danger font-medium">Failed to load dashboard data.</p>
        <p className="text-muted-text text-sm">Please refresh the page.</p>
      </div>
    );
  }

  const d = data!;

  const userGrowthData = d.growth.userGrowthTrend.map((t) => ({
    label: monthLabel(t.year, t.month),
    users: t.count,
  }));
  const leaseGrowthData = d.adoption.leaseGrowthTrend.map((t) => ({
    label: monthLabel(t.year, t.month),
    leases: t.count,
  }));
  const inviteData = d.inviteFunnel.trend.map((t) => ({
    label: monthLabel(t.year, t.month),
    sent: t.sent,
    accepted: t.accepted,
  }));

  // Revenue is per currency — never combined into one number. Render one chart
  // per currency that actually appears (each single-series, on the primary
  // token), so the picture stays honest across currencies.
  const revenueCurrencies = Array.from(
    new Set(d.financial.revenueTrend.map((r) => r.currency)),
  ).sort();
  const revenueByCurrency = revenueCurrencies.map((currency) => ({
    currency,
    data: d.financial.revenueTrend
      .filter((r) => r.currency === currency)
      .map((r) => ({ label: monthLabel(r.year, r.month), revenue: r.total })),
  }));

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold text-primary-text tracking-tight">
          Stakeholder dashboard
        </h1>
        <p className="text-sm text-muted-text mt-1">
          Key business metrics across the whole platform.
        </p>
      </div>

      {/* Growth & users */}
      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-primary-text">Growth &amp; users</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total users" value={d.growth.totalUsers} />
          <KpiCard label="Total landlords" value={d.growth.landlords} />
          <KpiCard label="Total tenants" value={d.growth.tenants} />
          <KpiCard label="New users this month" value={d.growth.newUsersThisMonth} />
        </div>
        <TrendChart
          title="New users per month"
          data={userGrowthData}
          xKey="label"
          series={[{ key: "users", name: "New users", color: "var(--color-primary)" }]}
        />
      </section>

      {/* Adoption & occupancy */}
      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-primary-text">Adoption &amp; occupancy</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total properties" value={d.adoption.totalProperties} />
          <KpiCard label="Active leases" value={d.adoption.activeLeases} />
          <KpiCard label="Occupancy" value={formatPercent(d.adoption.occupancyRate)} />
          <KpiCard
            label="Leases expiring soon"
            value={d.adoption.leasesExpiringSoon}
            hint="within the next 30 days"
          />
        </div>
        <TrendChart
          title="New leases per month"
          data={leaseGrowthData}
          xKey="label"
          series={[{ key: "leases", name: "New leases", color: "var(--color-primary)" }]}
        />
      </section>

      {/* Invite funnel */}
      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-primary-text">Invites</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Invites sent" value={d.inviteFunnel.sent} />
          <KpiCard label="Accepted" value={d.inviteFunnel.accepted} />
          <KpiCard label="Invite acceptance" value={formatPercent(d.inviteFunnel.acceptanceRate)} />
          <KpiCard
            label="Awaiting response"
            value={d.inviteFunnel.pending}
            hint={`${d.inviteFunnel.rejected} rejected · ${d.inviteFunnel.expired} expired`}
          />
        </div>
        <TrendChart
          title="Invites sent vs accepted"
          data={inviteData}
          xKey="label"
          series={[
            { key: "sent", name: "Sent", color: "var(--color-muted-text)" },
            { key: "accepted", name: "Accepted", color: "var(--color-primary)" },
          ]}
        />
      </section>

      {/* Financial & operations */}
      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-primary-text">Financial &amp; operations</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Payment confirmation rate" value={formatPercent(d.financial.confirmationRate)} />
          <KpiCard label="Avg. time to confirm" value={formatHours(d.financial.avgHoursToConfirm)} />
        </div>

        {/* Per currency — never summed across currencies. */}
        {d.financial.byCurrency.length === 0 ? (
          <p className="text-sm text-muted-text">No payments recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {d.financial.byCurrency.map((c) => (
              <div
                key={c.currency}
                className="bg-surface border border-border rounded-xl p-6"
              >
                <p className="text-sm font-medium text-primary-text mb-4">{c.currency}</p>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-sm text-muted-text mb-1">Confirmed</p>
                    <p className="text-xl font-semibold text-primary-text">
                      {formatMoney(c.currency, c.confirmed)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-text mb-1">Pending</p>
                    <p className="text-xl font-semibold text-primary-text">
                      {formatMoney(c.currency, c.pending)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-text mb-1">Outstanding</p>
                    <p className="text-xl font-semibold text-primary-text">
                      {formatMoney(c.currency, c.outstanding)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-text mb-1">Overdue</p>
                    <p
                      className={`text-xl font-semibold ${c.overdue > 0 ? "text-danger" : "text-primary-text"}`}
                    >
                      {formatMoney(c.currency, c.overdue)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {revenueByCurrency.map(({ currency, data: series }) => (
          <TrendChart
            key={currency}
            title={`Confirmed revenue per month — ${currency}`}
            data={series}
            xKey="label"
            series={[{ key: "revenue", name: currency, color: "var(--color-primary)" }]}
            valueFormatter={(v) => formatMoney(currency, v)}
          />
        ))}
      </section>

      {/* System health — a small line, not a headline KPI (per Decision 3). */}
      <p className="text-sm text-muted-text">
        System health: {d.systemHealth.failedEmailsThisMonth} failed{" "}
        {d.systemHealth.failedEmailsThisMonth === 1 ? "email" : "emails"} this month
        {" "}({d.systemHealth.failedEmailsTotal} total).
      </p>
    </div>
  );
}
