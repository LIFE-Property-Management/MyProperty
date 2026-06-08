using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyProperty.Application.Admin.Queries.GetStakeholderDashboard;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Options;

namespace MyProperty.Infrastructure.Caching;

/// <summary>
/// <see cref="IDistributedCache"/>-backed implementation of
/// <see cref="IStakeholderDashboardCache"/>.
///
/// <para>Key convention: <c>admin:stakeholder:dashboard</c> (a single global
/// key — the dashboard is system-wide). The instance prefix configured on the
/// underlying cache (see <see cref="CacheOptions.InstancePrefix"/>) is applied
/// transparently by <see cref="IDistributedCache"/>, so this class only deals
/// in logical keys.</para>
///
/// <para>Cache faults are swallowed and logged at <c>Warning</c>: the dashboard
/// endpoint must keep working if Redis is unreachable — it just becomes a
/// regular DB-backed query for the duration of the outage. Identical contract
/// to <see cref="RedisLandlordDashboardCache"/>.</para>
/// </summary>
internal sealed class RedisStakeholderDashboardCache(
    IDistributedCache cache,
    IOptions<CacheOptions> options,
    ILogger<RedisStakeholderDashboardCache> logger) : IStakeholderDashboardCache
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    private readonly TimeSpan _ttl = TimeSpan.FromSeconds(options.Value.StakeholderDashboardTtlSeconds);

    public async Task<StakeholderDashboardDto?> GetAsync(CancellationToken ct)
    {
        try
        {
            var bytes = await cache.GetAsync(CacheKeys.StakeholderDashboard(), ct);
            return bytes is null
                ? null
                : JsonSerializer.Deserialize<StakeholderDashboardDto>(bytes, SerializerOptions);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex,
                "Stakeholder-dashboard cache GET failed; falling through to DB.");
            return null;
        }
    }

    public async Task SetAsync(StakeholderDashboardDto dashboard, CancellationToken ct)
    {
        try
        {
            var bytes = JsonSerializer.SerializeToUtf8Bytes(dashboard, SerializerOptions);
            await cache.SetAsync(
                CacheKeys.StakeholderDashboard(),
                bytes,
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = _ttl },
                ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex,
                "Stakeholder-dashboard cache SET failed; entry will be re-fetched on next request.");
        }
    }

    public async Task InvalidateAsync(CancellationToken ct)
    {
        try
        {
            await cache.RemoveAsync(CacheKeys.StakeholderDashboard(), ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex,
                "Stakeholder-dashboard cache INVALIDATE failed; stale data may persist for up to {TtlSeconds}s.",
                (int)_ttl.TotalSeconds);
        }
    }
}
