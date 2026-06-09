using Microsoft.EntityFrameworkCore;
using MyProperty.Application.Admin.Queries.GetStakeholderDashboard;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Domain.Enums;

namespace MyProperty.Infrastructure.Persistence.Repositories;

/// <summary>
/// Aggregates the system-wide stakeholder KPIs. Soft-deleted rows are excluded
/// automatically by the global query filter on <c>BaseEntity</c>.
/// </summary>
internal sealed class StakeholderDashboardRepository(AppDbContext db) : IStakeholderDashboardRepository
{
    public async Task<StakeholderDashboardDto> GetAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        // Trend window: exactly 12 calendar-month buckets — the current month
        // plus the prior 11. Anchoring the lower bound to monthStart (rather
        // than now.AddMonths(-12), which leaks a partial 13th bucket for the
        // same month a year ago) keeps the SQL filter and the in-memory
        // gap-fill skeleton agreeing on the same 12 months.
        var trendFrom = monthStart.AddMonths(-11);
        // Contiguous ascending (year, month) skeleton of the window. The grouped
        // trend queries below omit months with no rows; merging against this
        // skeleton restores them as explicit zeros so the line charts don't
        // silently drop empty months. Kept index-friendly by the 12-month bound.
        var monthsWindow = Enumerable.Range(0, 12)
            .Select(i => monthStart.AddMonths(-11 + i))
            .Select(d => (d.Year, d.Month))
            .ToList();
        var today = DateOnly.FromDateTime(now);
        var expiringCutoff = today.AddDays(30);

        // EF cannot share a DbContext across concurrent queries, so the metrics
        // run sequentially (same constraint noted in LandlordDashboardRepository).
        // Trends use .GroupBy(year, month) which Npgsql translates to native
        // date_part grouping — no raw SQL.

        // ── Growth & users ──────────────────────────────────────────────────
        var totalUsers = await db.Users.CountAsync(ct);
        // Roles aren't on User (Keycloak owns them) — derive from relationships.
        var landlords = await db.Properties.Select(p => p.LandlordId).Distinct().CountAsync(ct);
        var tenants = await db.Leases.Select(l => l.TenantId).Distinct().CountAsync(ct);
        var newUsersThisMonth = await db.Users.CountAsync(u => u.CreatedAt >= monthStart, ct);

        var userGrowthRaw = await db.Users
            .Where(u => u.CreatedAt >= trendFrom)
            .GroupBy(u => new { u.CreatedAt.Year, u.CreatedAt.Month })
            .Select(g => new MonthlyCountDto(g.Key.Year, g.Key.Month, g.Count()))
            .ToListAsync(ct);
        var userGrowthTrend = GapFill(
            monthsWindow, userGrowthRaw,
            x => (x.Year, x.Month),
            (y, m) => new MonthlyCountDto(y, m, 0));

        var growth = new GrowthSection(
            TotalUsers: totalUsers,
            Landlords: landlords,
            Tenants: tenants,
            NewUsersThisMonth: newUsersThisMonth,
            UserGrowthTrend: userGrowthTrend);

        // ── Adoption & occupancy ────────────────────────────────────────────
        var totalProperties = await db.Properties.CountAsync(ct);
        var activeLeases = await db.Leases.CountAsync(l => l.Status == LeaseStatus.Active, ct);
        var occupiedProperties = await db.Leases
            .Where(l => l.Status == LeaseStatus.Active)
            .Select(l => l.PropertyId)
            .Distinct()
            .CountAsync(ct);
        var occupancyRate = totalProperties == 0
            ? 0m
            : (decimal)occupiedProperties / totalProperties;
        var leasesExpiringSoon = await db.Leases
            .CountAsync(l => l.Status == LeaseStatus.Active && l.EndDate <= expiringCutoff, ct);
        var newLeasesThisMonth = await db.Leases.CountAsync(l => l.CreatedAt >= monthStart, ct);

        var leaseGrowthRaw = await db.Leases
            .Where(l => l.CreatedAt >= trendFrom)
            .GroupBy(l => new { l.CreatedAt.Year, l.CreatedAt.Month })
            .Select(g => new MonthlyCountDto(g.Key.Year, g.Key.Month, g.Count()))
            .ToListAsync(ct);
        var leaseGrowthTrend = GapFill(
            monthsWindow, leaseGrowthRaw,
            x => (x.Year, x.Month),
            (y, m) => new MonthlyCountDto(y, m, 0));

        var adoption = new AdoptionSection(
            TotalProperties: totalProperties,
            ActiveLeases: activeLeases,
            OccupancyRate: occupancyRate,
            LeasesExpiringSoon: leasesExpiringSoon,
            NewLeasesThisMonth: newLeasesThisMonth,
            LeaseGrowthTrend: leaseGrowthTrend);

        // ── Invite funnel ───────────────────────────────────────────────────
        var inviteByStatus = await db.Invites
            .GroupBy(i => i.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);
        int CountFor(InviteStatus s) => inviteByStatus.FirstOrDefault(x => x.Status == s)?.Count ?? 0;
        var pending = CountFor(InviteStatus.Pending);
        var accepted = CountFor(InviteStatus.Accepted);
        var rejected = CountFor(InviteStatus.Rejected);
        var expired = CountFor(InviteStatus.Expired);
        var sent = pending + accepted + rejected + expired; // Sent = total invites.
        var acceptanceRate = sent == 0 ? 0m : (decimal)accepted / sent;

        var inviteTrendRaw = await db.Invites
            .Where(i => i.CreatedAt >= trendFrom)
            .GroupBy(i => new { i.CreatedAt.Year, i.CreatedAt.Month })
            .Select(g => new MonthlyInviteDto(
                g.Key.Year,
                g.Key.Month,
                g.Count(),
                g.Count(i => i.Status == InviteStatus.Accepted)))
            .ToListAsync(ct);
        var inviteTrend = GapFill(
            monthsWindow, inviteTrendRaw,
            x => (x.Year, x.Month),
            (y, m) => new MonthlyInviteDto(y, m, 0, 0));

        var inviteFunnel = new InviteFunnelSection(
            Sent: sent,
            Accepted: accepted,
            Rejected: rejected,
            Expired: expired,
            Pending: pending,
            AcceptanceRate: acceptanceRate,
            Trend: inviteTrend);

        // ── Financial & operations (grouped BY currency; never summed across) ─
        var byCurrency = await db.Payments
            .GroupBy(p => p.Currency)
            .OrderBy(g => g.Key)
            .Select(g => new CurrencyTotalsDto(
                g.Key,
                g.Sum(p => p.Status == PaymentStatus.Confirmed ? p.Amount : 0m),
                g.Sum(p => p.Status == PaymentStatus.Pending ? p.Amount : 0m),
                g.Sum(p => p.Status == PaymentStatus.Outstanding ? p.Amount : 0m),
                g.Sum(p => p.Status == PaymentStatus.Outstanding && p.DueDate < today ? p.Amount : 0m)))
            .ToListAsync(ct);

        var confirmedCount = await db.Payments.CountAsync(p => p.Status == PaymentStatus.Confirmed, ct);
        var rejectedCount = await db.Payments.CountAsync(p => p.Status == PaymentStatus.Rejected, ct);
        var confirmationRate = (confirmedCount + rejectedCount) == 0
            ? 0m
            : (decimal)confirmedCount / (confirmedCount + rejectedCount);

        // Avg time-to-confirm: project the two timestamps for confirmed payments
        // and average the gap in C#.
        // scale: acceptable now — the confirmed set is bounded. If confirmed-payment
        // volume ever grows large, push the averaging into SQL (AVG over an
        // interval expression) rather than materializing the rows here.
        var confirmedTimestamps = await db.Payments
            .Where(p => p.Status == PaymentStatus.Confirmed
                     && p.ConfirmedAt != null
                     && p.SubmittedAt != null)
            .Select(p => new { p.SubmittedAt, p.ConfirmedAt })
            .ToListAsync(ct);
        var avgHoursToConfirm = confirmedTimestamps.Count == 0
            ? 0m
            : (decimal)confirmedTimestamps.Average(x => (x.ConfirmedAt!.Value - x.SubmittedAt!.Value).TotalHours);

        var revenueRaw = await db.Payments
            .Where(p => p.Status == PaymentStatus.Confirmed
                     && p.ConfirmedAt != null
                     && p.ConfirmedAt >= trendFrom)
            .GroupBy(p => new { p.Currency, p.ConfirmedAt!.Value.Year, p.ConfirmedAt!.Value.Month })
            .Select(g => new MonthlyCurrencyAmountDto(
                g.Key.Currency,
                g.Key.Year,
                g.Key.Month,
                g.Sum(p => p.Amount)))
            .ToListAsync(ct);
        // Every currency that appears gets its own contiguous 12-month series
        // (ordered by currency, then year, then month), zero-filled per month.
        var revenueByKey = revenueRaw.ToDictionary(x => (x.Currency, x.Year, x.Month));
        var revenueTrend = revenueRaw
            .Select(x => x.Currency)
            .Distinct()
            .OrderBy(c => c)
            .SelectMany(c => monthsWindow.Select(m =>
                revenueByKey.TryGetValue((c, m.Year, m.Month), out var dto)
                    ? dto
                    : new MonthlyCurrencyAmountDto(c, m.Year, m.Month, 0m)))
            .ToList();

        var financial = new FinancialSection(
            ByCurrency: byCurrency,
            ConfirmationRate: confirmationRate,
            AvgHoursToConfirm: avgHoursToConfirm,
            RevenueTrend: revenueTrend);

        // ── System health (small line, not a headline KPI) ──────────────────
        var failedEmailsTotal = await db.FailedEmails.CountAsync(ct);
        // FailedEmail carries a dedicated FailedAt business timestamp (distinct
        // from the inherited CreatedAt audit field) — use it for the this-month
        // metric so "failures this month" means failures that occurred this month.
        var failedEmailsThisMonth = await db.FailedEmails.CountAsync(e => e.FailedAt >= monthStart, ct);

        var systemHealth = new SystemHealthSection(
            FailedEmailsTotal: failedEmailsTotal,
            FailedEmailsThisMonth: failedEmailsThisMonth);

        return new StakeholderDashboardDto(
            Growth: growth,
            Adoption: adoption,
            InviteFunnel: inviteFunnel,
            Financial: financial,
            SystemHealth: systemHealth,
            GeneratedAt: DateTime.UtcNow);

        // Merges grouped trend rows against the contiguous month skeleton,
        // inserting an explicit zero bucket (built by `zero`) for any month
        // with no rows. The window drives the final ascending order, so the
        // grouped queries above don't need their own ORDER BY.
        static List<TDto> GapFill<TDto>(
            IReadOnlyList<(int Year, int Month)> window,
            IReadOnlyList<TDto> rows,
            Func<TDto, (int Year, int Month)> keyOf,
            Func<int, int, TDto> zero)
        {
            var byKey = rows.ToDictionary(keyOf);
            return window
                .Select(m => byKey.TryGetValue(m, out var dto) ? dto : zero(m.Year, m.Month))
                .ToList();
        }
    }
}
