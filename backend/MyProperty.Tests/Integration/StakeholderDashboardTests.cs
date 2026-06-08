using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using MyProperty.Application.Admin.Queries.GetStakeholderDashboard;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;
using MyProperty.Tests.Integration.Fixtures;

namespace MyProperty.Tests.Integration;

/// <summary>
/// Exercises <c>GET /api/v1/admin/dashboard</c>: the RequireAdmin gate, the
/// system-wide aggregate math, the cache-aside flow, and the trend gap-fill /
/// 12-month-window / FailedAt behavior.
///
/// The dashboard is global and the integration DB is shared across the
/// collection, so global ratios (occupancy, acceptance, avg-hours) are checked
/// by recomputing the expected value from the live DB state at assertion time —
/// deterministic because tests in a collection run sequentially. Per-currency
/// totals use a currency code unique to this test for an exact check, and the
/// FailedAt semantics are proven via before/after deltas.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class StakeholderDashboardTests(ApiFixture fixture)
{
    // Currency codes used by exactly one test each, so per-currency totals are
    // exact regardless of what other tests in the collection seed. The two tests
    // must NOT share a code — they seed into the same (shared) DB and run in an
    // unspecified order.
    private const string UniqueCurrency = "QZX"; // aggregates test
    private const string TrendCurrency = "QZY";  // trends test

    private static async Task<StakeholderDashboardDto> GetDashboardAsync(HttpClient client)
    {
        var resp = await client.GetAsync("/api/v1/admin/dashboard");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var dto = await resp.Content.ReadFromJsonAsync<StakeholderDashboardDto>();
        Assert.NotNull(dto);
        return dto!;
    }

    [Fact]
    public async Task Dashboard_returns_403_for_non_admin()
    {
        var landlord = await fixture.CreateAuthenticatedClientAsync(ApiFixture.LandlordEmail);
        var resp = await landlord.GetAsync("/api/v1/admin/dashboard");
        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task Dashboard_returns_correct_aggregates_for_admin()
    {
        var admin = await fixture.CreateAuthenticatedClientAsync(ApiFixture.AdminEmail);

        // Seed a self-contained slice: a landlord + tenant, a property + active
        // lease (occupancy), two confirmed payments in a UNIQUE currency (exact
        // per-currency total + a known submit→confirm gap), and a mixed invite
        // pair (funnel). Seeding our own landlord User keeps the test isolated
        // from whether the seed Keycloak users have been synced into the app DB.
        var landlordId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        var leaseId = Guid.NewGuid();

        await fixture.WithDbAsync(async db =>
        {
            db.Users.Add(new User
            {
                Id = landlordId,
                KeycloakSubId = $"stk-landlord-{Guid.NewGuid():N}",
                Email = $"stk-landlord-{Guid.NewGuid():N}@test.local",
                FirstName = "Stk",
                LastName = "Landlord",
            });
            var tenant = new User
            {
                Id = Guid.NewGuid(),
                KeycloakSubId = $"stk-tenant-{Guid.NewGuid():N}",
                Email = $"stk-tenant-{Guid.NewGuid():N}@test.local",
                FirstName = "Stk",
                LastName = "Tenant",
            };
            db.Users.Add(tenant);
            db.Properties.Add(new Property
            {
                Id = propertyId,
                LandlordId = landlordId,
                Name = "Stakeholder Apt",
                Address = "1 Stakeholder St",
            });
            db.Leases.Add(new Lease
            {
                Id = leaseId,
                LandlordId = landlordId,
                PropertyId = propertyId,
                TenantId = tenant.Id,
                StartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date),
                EndDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
                MonthlyRent = 1000m,
                Currency = UniqueCurrency,
            });

            // Two confirmed payments in the unique currency: 100 + 150 = 250,
            // each with a known submit→confirm gap (used by avg-hours recompute).
            var now = DateTime.UtcNow;
            db.Payments.Add(new Payment
            {
                Id = Guid.NewGuid(),
                LeaseId = leaseId,
                Amount = 100m,
                Currency = UniqueCurrency,
                DueDate = DateOnly.FromDateTime(now.Date),
                Status = PaymentStatus.Confirmed,
                SubmittedAt = now.AddHours(-4),
                ConfirmedAt = now,
            });
            db.Payments.Add(new Payment
            {
                Id = Guid.NewGuid(),
                LeaseId = leaseId,
                Amount = 150m,
                Currency = UniqueCurrency,
                DueDate = DateOnly.FromDateTime(now.Date),
                Status = PaymentStatus.Confirmed,
                SubmittedAt = now.AddHours(-2),
                ConfirmedAt = now,
            });
            // A pending payment in the same currency — must NOT count toward
            // the confirmed total.
            db.Payments.Add(new Payment
            {
                Id = Guid.NewGuid(),
                LeaseId = leaseId,
                Amount = 999m,
                Currency = UniqueCurrency,
                DueDate = DateOnly.FromDateTime(now.Date),
                Status = PaymentStatus.Pending,
                SubmittedAt = now.AddHours(-1),
            });

            // A mixed invite pair so the funnel is non-trivial.
            db.Invites.Add(BuildInvite(landlordId, propertyId, InviteStatus.Accepted));
            db.Invites.Add(BuildInvite(landlordId, propertyId, InviteStatus.Pending));

            await db.SaveChangesAsync();
        });

        await fixture.EvictStakeholderDashboardCacheAsync();
        var dto = await GetDashboardAsync(admin);

        // ── Per-currency confirmed total (exact — unique currency) ───────────
        var qzx = dto.Financial.ByCurrency.Single(c => c.Currency == UniqueCurrency);
        Assert.Equal(250m, qzx.Confirmed);
        Assert.Equal(999m, qzx.Pending);

        // ── Occupancy math (recomputed from live DB) ─────────────────────────
        var (occupied, totalProperties) = await fixture.WithDbAsync(async db =>
        {
            var occ = await db.Leases
                .Where(l => l.Status == LeaseStatus.Active)
                .Select(l => l.PropertyId).Distinct().CountAsync();
            var total = await db.Properties.CountAsync();
            return (occ, total);
        });
        var expectedOccupancy = totalProperties == 0 ? 0m : (decimal)occupied / totalProperties;
        Assert.Equal(expectedOccupancy, dto.Adoption.OccupancyRate);
        Assert.InRange(dto.Adoption.OccupancyRate, 0m, 1m);

        // ── Invite acceptance rate (recomputed from live DB) ─────────────────
        var (accepted, sentTotal) = await fixture.WithDbAsync(async db =>
        {
            var acc = await db.Invites.CountAsync(i => i.Status == InviteStatus.Accepted);
            var total = await db.Invites.CountAsync();
            return (acc, total);
        });
        var expectedAcceptance = sentTotal == 0 ? 0m : (decimal)accepted / sentTotal;
        Assert.Equal(expectedAcceptance, dto.InviteFunnel.AcceptanceRate);
        Assert.Equal(sentTotal, dto.InviteFunnel.Sent);

        // ── Avg time-to-confirm (recomputed from live DB) ────────────────────
        var gaps = await fixture.WithDbAsync(db => db.Payments
            .Where(p => p.Status == PaymentStatus.Confirmed
                     && p.ConfirmedAt != null && p.SubmittedAt != null)
            .Select(p => new { p.SubmittedAt, p.ConfirmedAt })
            .ToListAsync());
        var expectedAvgHours = gaps.Count == 0
            ? 0m
            : (decimal)gaps.Average(x => (x.ConfirmedAt!.Value - x.SubmittedAt!.Value).TotalHours);
        Assert.Equal(expectedAvgHours, dto.Financial.AvgHoursToConfirm, 2);

        // ── Cache behavior: second read is a hit (identical GeneratedAt) ─────
        var dto2 = await GetDashboardAsync(admin);
        Assert.Equal(dto.GeneratedAt, dto2.GeneratedAt);
    }

    [Fact]
    public async Task Trends_are_gap_filled_to_exactly_twelve_months()
    {
        var admin = await fixture.CreateAuthenticatedClientAsync(ApiFixture.AdminEmail);

        // Seed one confirmed payment in the unique trend currency so a revenue
        // series for that currency exists (then assert it is gap-filled to 12
        // buckets). Self-contained landlord/tenant keep the test isolated.
        await fixture.WithDbAsync(async db =>
        {
            var landlordId = Guid.NewGuid();
            var propertyId = Guid.NewGuid();
            var leaseId = Guid.NewGuid();
            db.Users.Add(new User
            {
                Id = landlordId,
                KeycloakSubId = $"stk-trend-landlord-{Guid.NewGuid():N}",
                Email = $"stk-trend-landlord-{Guid.NewGuid():N}@test.local",
                FirstName = "Trend",
                LastName = "Landlord",
            });
            var tenant = new User
            {
                Id = Guid.NewGuid(),
                KeycloakSubId = $"stk-trend-{Guid.NewGuid():N}",
                Email = $"stk-trend-{Guid.NewGuid():N}@test.local",
                FirstName = "Trend",
                LastName = "Tenant",
            };
            db.Users.Add(tenant);
            db.Properties.Add(new Property
            {
                Id = propertyId,
                LandlordId = landlordId,
                Name = "Trend Apt",
                Address = "2 Trend St",
            });
            db.Leases.Add(new Lease
            {
                Id = leaseId,
                LandlordId = landlordId,
                PropertyId = propertyId,
                TenantId = tenant.Id,
                StartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date),
                EndDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
                MonthlyRent = 500m,
                Currency = TrendCurrency,
            });
            db.Payments.Add(new Payment
            {
                Id = Guid.NewGuid(),
                LeaseId = leaseId,
                Amount = 500m,
                Currency = TrendCurrency,
                DueDate = DateOnly.FromDateTime(DateTime.UtcNow.Date),
                Status = PaymentStatus.Confirmed,
                SubmittedAt = DateTime.UtcNow.AddHours(-3),
                ConfirmedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
        });

        await fixture.EvictStakeholderDashboardCacheAsync();
        var dto = await GetDashboardAsync(admin);

        // (c) Each count-based trend has exactly 12 month buckets.
        Assert.Equal(12, dto.Growth.UserGrowthTrend.Count);
        Assert.Equal(12, dto.Adoption.LeaseGrowthTrend.Count);
        Assert.Equal(12, dto.InviteFunnel.Trend.Count);

        // Buckets are ascending and contiguous (no month repeated or skipped).
        AssertContiguousAscending(dto.Growth.UserGrowthTrend.Select(t => (t.Year, t.Month)).ToList());
        AssertContiguousAscending(dto.Adoption.LeaseGrowthTrend.Select(t => (t.Year, t.Month)).ToList());
        AssertContiguousAscending(dto.InviteFunnel.Trend.Select(t => (t.Year, t.Month)).ToList());

        // (c) The revenue series for the unique currency is also gap-filled to
        // exactly 12 buckets.
        var trendRevenue = dto.Financial.RevenueTrend.Where(r => r.Currency == TrendCurrency).ToList();
        Assert.Equal(12, trendRevenue.Count);
        AssertContiguousAscending(trendRevenue.Select(r => (r.Year, r.Month)).ToList());

        // (a) A month with no rows is present as an explicit zero. New users get
        // CreatedAt = now (set by the audit interceptor), so the bucket six
        // months back cannot have any users — it must be a gap-filled zero.
        var now = DateTime.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var sixMonthsAgo = monthStart.AddMonths(-6);
        var emptyBucket = dto.Growth.UserGrowthTrend
            .Single(t => t.Year == sixMonthsAgo.Year && t.Month == sixMonthsAgo.Month);
        Assert.Equal(0, emptyBucket.Count);

        // The revenue series for QZY confirmed this month should carry a value
        // in the current-month bucket and zeros elsewhere — proves per-currency
        // zero-fill rather than dropping empty months.
        var currentRevenue = trendRevenue.Single(r => r.Year == now.Year && r.Month == now.Month);
        Assert.Equal(500m, currentRevenue.Total);
        var pastRevenue = trendRevenue.Single(r => r.Year == sixMonthsAgo.Year && r.Month == sixMonthsAgo.Month);
        Assert.Equal(0m, pastRevenue.Total);
    }

    [Fact]
    public async Task Failed_email_this_month_uses_FailedAt_not_CreatedAt()
    {
        var admin = await fixture.CreateAuthenticatedClientAsync(ApiFixture.AdminEmail);

        await fixture.EvictStakeholderDashboardCacheAsync();
        var before = (await GetDashboardAsync(admin)).SystemHealth;

        // Seed two failed emails: one that FAILED in a prior month and one that
        // failed now. Both get CreatedAt = now via the audit interceptor, so if
        // the metric (incorrectly) used CreatedAt both would count this month.
        // Using FailedAt, only the current-month one should.
        await fixture.WithDbAsync(async db =>
        {
            db.FailedEmails.Add(BuildFailedEmail(failedAt: DateTime.UtcNow.AddMonths(-3)));
            db.FailedEmails.Add(BuildFailedEmail(failedAt: DateTime.UtcNow));
            await db.SaveChangesAsync();
        });

        await fixture.EvictStakeholderDashboardCacheAsync();
        var after = (await GetDashboardAsync(admin)).SystemHealth;

        // Total counts both regardless of date; this-month counts only the one
        // whose FailedAt is in the current month.
        Assert.Equal(before.FailedEmailsTotal + 2, after.FailedEmailsTotal);
        Assert.Equal(before.FailedEmailsThisMonth + 1, after.FailedEmailsThisMonth);
    }

    private static void AssertContiguousAscending(IReadOnlyList<(int Year, int Month)> buckets)
    {
        for (var i = 1; i < buckets.Count; i++)
        {
            var prev = buckets[i - 1];
            var cur = buckets[i];
            var expected = new DateTime(prev.Year, prev.Month, 1).AddMonths(1);
            Assert.Equal((expected.Year, expected.Month), cur);
        }
    }

    private static Invite BuildInvite(Guid landlordId, Guid propertyId, InviteStatus status) => new()
    {
        Id = Guid.NewGuid(),
        LandlordId = landlordId,
        PropertyId = propertyId,
        Email = $"invitee-{Guid.NewGuid():N}@test.local",
        FirstName = "Invitee",
        LastName = "Test",
        TokenHash = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N"),
        Status = status,
        ExpiresAt = DateTime.UtcNow.AddDays(7),
        ProposedStartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date),
        ProposedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
        ProposedMonthlyRent = 700m,
        Currency = "EUR",
    };

    private static FailedEmail BuildFailedEmail(DateTime failedAt) => new()
    {
        Id = Guid.NewGuid(),
        ToAddress = $"bounce-{Guid.NewGuid():N}@test.local",
        Subject = "Test failure",
        Body = "body",
        IsHtml = false,
        HangfireJobId = Guid.NewGuid().ToString("N"),
        AttemptCount = 5,
        LastError = "SMTP timeout",
        FailedAt = failedAt,
    };
}
