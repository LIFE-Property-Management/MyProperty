using FluentValidation;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;

namespace MyProperty.Application.Landlord.Queries.GetLandlordDashboard;

/// <summary>
/// Cache-aside read of the landlord dashboard (M3.5):
/// <list type="number">
///   <item>Try the cache. Hit ⇒ return.</item>
///   <item>Miss ⇒ query the DB, populate the cache, return.</item>
/// </list>
/// The cache key, TTL and serialization live behind <see cref="ILandlordDashboardCache"/>;
/// the handler is unaware of Redis.
/// </summary>
public sealed class GetLandlordDashboardHandler(
    IValidator<GetLandlordDashboardQuery> validator,
    ILandlordDashboardCache cache,
    ILandlordDashboardRepository repository)
{
    public async Task<LandlordDashboardDto> Handle(
        GetLandlordDashboardQuery query, CancellationToken ct)
    {
        await validator.EnsureValidAsync(query, ct);

        var cached = await cache.GetAsync(query.LandlordId, ct);
        if (cached is not null)
            return cached;

        var fresh = await repository.GetForLandlordAsync(query.LandlordId, ct);
        await cache.SetAsync(query.LandlordId, fresh, ct);
        return fresh;
    }
}
