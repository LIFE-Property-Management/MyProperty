using MyProperty.Application.Stats.Queries.GetPublicStats;

namespace MyProperty.Application.Common.Interfaces;

/// <summary>
/// Read-only repository that aggregates the public landing-page stats.
/// The handler calls this directly; there is no caching layer.
/// </summary>
public interface IPublicStatsRepository
{
    Task<PublicStatsDto> GetAsync(CancellationToken ct);
}
