using MyProperty.Application.Landlord.Queries.GetLandlordDashboard;

namespace MyProperty.Application.Common.Interfaces;

/// <summary>
/// Cache-aside store for landlord dashboard aggregates (M3.5).
/// Implementations own the cache-key convention (<c>landlord:{id}:dashboard</c>)
/// and the TTL — handlers stay free of caching concerns and just call
/// <see cref="GetAsync"/> / <see cref="SetAsync"/> / <see cref="InvalidateAsync"/>.
/// </summary>
public interface ILandlordDashboardCache
{
    /// <summary>Returns the cached dashboard for the landlord, or null on miss.</summary>
    Task<LandlordDashboardDto?> GetAsync(Guid landlordId, CancellationToken ct);

    /// <summary>Writes the dashboard to the cache with the configured TTL.</summary>
    Task SetAsync(Guid landlordId, LandlordDashboardDto dashboard, CancellationToken ct);

    /// <summary>
    /// Removes the cached dashboard for the landlord. Called from write
    /// handlers that mutate landlord-relevant state (lease created, payment
    /// submitted/confirmed/rejected) so the next read repopulates from the DB.
    /// </summary>
    Task InvalidateAsync(Guid landlordId, CancellationToken ct);
}
