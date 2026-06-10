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
        var rentCollected = await db.Payments
            .Where(p => p.Status == PaymentStatus.Confirmed)
            .SumAsync(p => (decimal?)p.Amount, ct) ?? 0m;

        var propertiesManaged = await db.Properties.CountAsync(ct);

        var landlordsOnboarded = await db.Properties
            .Select(p => p.LandlordId)
            .Distinct()
            .CountAsync(ct);

        return new PublicStatsDto(rentCollected, propertiesManaged, landlordsOnboarded);
    }
}
