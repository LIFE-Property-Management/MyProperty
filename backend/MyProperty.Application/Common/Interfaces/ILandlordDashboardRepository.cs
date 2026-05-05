using MyProperty.Application.Landlord.Queries.GetLandlordDashboard;

namespace MyProperty.Application.Common.Interfaces;

/// <summary>
/// Read-only repository that aggregates the landlord-dashboard counters from
/// the database. The shape mirrors <see cref="LandlordDashboardDto"/> exactly —
/// the handler layers caching on top, the repository just runs the query.
/// </summary>
public interface ILandlordDashboardRepository
{
    Task<LandlordDashboardDto> GetForLandlordAsync(Guid landlordId, CancellationToken ct);
}
