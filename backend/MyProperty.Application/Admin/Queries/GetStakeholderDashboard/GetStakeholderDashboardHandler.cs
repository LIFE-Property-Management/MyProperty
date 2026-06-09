using FluentValidation;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;

namespace MyProperty.Application.Admin.Queries.GetStakeholderDashboard;

/// <summary>
/// Cache-aside read of the system-wide stakeholder dashboard:
/// <list type="number">
///   <item>Try the cache. Hit ⇒ return.</item>
///   <item>Miss ⇒ query the DB, populate the cache, return.</item>
/// </list>
/// The cache key, TTL and serialization live behind <see cref="IStakeholderDashboardCache"/>;
/// the handler is unaware of Redis. Identical shape to <c>GetLandlordDashboardHandler</c>.
/// </summary>
public sealed class GetStakeholderDashboardHandler(
    IValidator<GetStakeholderDashboardQuery> validator,
    IStakeholderDashboardCache cache,
    IStakeholderDashboardRepository repository)
{
    public async Task<StakeholderDashboardDto> Handle(
        GetStakeholderDashboardQuery query, CancellationToken ct)
    {
        await validator.EnsureValidAsync(query, ct);

        var cached = await cache.GetAsync(ct);
        if (cached is not null)
            return cached;

        var fresh = await repository.GetAsync(ct);
        await cache.SetAsync(fresh, ct);
        return fresh;
    }
}
