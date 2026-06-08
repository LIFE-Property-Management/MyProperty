using MyProperty.Application.Admin.Queries.GetStakeholderDashboard;

namespace MyProperty.Application.Common.Interfaces;

/// <summary>
/// Cache-aside store for the stakeholder (product-lead) dashboard. The data is
/// system-wide, so there is a single global key (<c>admin:stakeholder:dashboard</c>)
/// — no id parameter. Implementations own the key convention and TTL; the
/// handler stays free of caching concerns and just calls
/// <see cref="GetAsync"/> / <see cref="SetAsync"/> / <see cref="InvalidateAsync"/>.
/// </summary>
public interface IStakeholderDashboardCache
{
    /// <summary>Returns the cached dashboard, or null on miss.</summary>
    Task<StakeholderDashboardDto?> GetAsync(CancellationToken ct);

    /// <summary>Writes the dashboard to the cache with the configured TTL.</summary>
    Task SetAsync(StakeholderDashboardDto dashboard, CancellationToken ct);

    /// <summary>
    /// Removes the cached dashboard. The TTL (5 min) makes explicit
    /// invalidation optional for correctness, but the method exists so a
    /// future write path can force a refresh if needed.
    /// </summary>
    Task InvalidateAsync(CancellationToken ct);
}
