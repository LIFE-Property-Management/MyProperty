using Microsoft.EntityFrameworkCore;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Stats.Queries.GetPublicStats;
using MyProperty.Domain.Enums;

namespace MyProperty.Infrastructure.Persistence.Repositories;

/// <summary>
/// Aggregates the three public landing-page counters. Soft-deleted rows
/// are excluded automatically by the global query filter on <c>BaseEntity</c>.
/// </summary>
internal sealed class PublicStatsRepository(AppDbContext db) : IPublicStatsRepository
{
    public async Task<PublicStatsDto> GetAsync(CancellationToken ct)
    {
        // Rent is never summed across currencies (each lease/payment carries its
        // own ISO-4217 currency — see StakeholderDashboardRepository's "never
        // summed across" rule). For the single headline number the landing page
        // wants, report the most-used currency: the one with the most confirmed
        // payments, summing only that currency's confirmed amount. Ties broken
        // by currency code for determinism.
        var topCurrency = await db.Payments
            .Where(p => p.Status == PaymentStatus.Confirmed)
            .GroupBy(p => p.Currency)
            .Select(g => new { Currency = g.Key, Count = g.Count(), Total = g.Sum(p => p.Amount) })
            .OrderByDescending(x => x.Count)
            .ThenBy(x => x.Currency)
            .FirstOrDefaultAsync(ct);

        var rentCollected = topCurrency?.Total ?? 0m;
        var currency = topCurrency?.Currency ?? "";

        var propertiesManaged = await db.Properties.CountAsync(ct);

        var landlordsOnboarded = await db.Properties
            .Select(p => p.LandlordId)
            .Distinct()
            .CountAsync(ct);

        return new PublicStatsDto(rentCollected, currency, propertiesManaged, landlordsOnboarded);
    }
}
