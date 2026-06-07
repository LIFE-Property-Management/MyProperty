using System.Text.Json;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Options;
using MyProperty.Application.Landlord.Queries.GetLandlordDashboard;

namespace MyProperty.Infrastructure.Caching;

/// <summary>
/// <see cref="IDistributedCache"/>-backed implementation of
/// <see cref="ILandlordDashboardCache"/>.
///
/// <para>Key convention: <c>landlord:{landlordId}:dashboard</c>. The instance
/// prefix configured on the underlying cache (see
/// <see cref="CacheOptions.InstancePrefix"/>) is applied transparently by
/// <see cref="IDistributedCache"/>, so this class only deals in logical keys.</para>
///
/// <para>Cache faults are swallowed and logged at <c>Warning</c>: the
/// dashboard endpoint must continue to function if Redis is unreachable —
/// it just becomes a regular DB-backed query for the duration of the outage.</para>
/// </summary>
internal sealed class RedisLandlordDashboardCache(
    IDistributedCache cache,
    IOptions<CacheOptions> options,
    ILogger<RedisLandlordDashboardCache> logger) : ILandlordDashboardCache
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    private readonly TimeSpan _ttl = TimeSpan.FromSeconds(options.Value.LandlordDashboardTtlSeconds);

    public async Task<LandlordDashboardDto?> GetAsync(Guid landlordId, CancellationToken ct)
    {
        try
        {
            var bytes = await cache.GetAsync(KeyFor(landlordId), ct);
            return bytes is null
                ? null
                : JsonSerializer.Deserialize<LandlordDashboardDto>(bytes, SerializerOptions);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex,
                "Landlord-dashboard cache GET failed for {LandlordId}; falling through to DB.",
                landlordId);
            return null;
        }
    }

    public async Task SetAsync(Guid landlordId, LandlordDashboardDto dashboard, CancellationToken ct)
    {
        try
        {
            var bytes = JsonSerializer.SerializeToUtf8Bytes(dashboard, SerializerOptions);
            await cache.SetAsync(
                KeyFor(landlordId),
                bytes,
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = _ttl },
                ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex,
                "Landlord-dashboard cache SET failed for {LandlordId}; entry will be re-fetched on next request.",
                landlordId);
        }
    }

    public async Task InvalidateAsync(Guid landlordId, CancellationToken ct)
    {
        try
        {
            await cache.RemoveAsync(KeyFor(landlordId), ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex,
                "Landlord-dashboard cache INVALIDATE failed for {LandlordId}; stale data may persist for up to {TtlSeconds}s.",
                landlordId, (int)_ttl.TotalSeconds);
        }
    }

    private static string KeyFor(Guid landlordId) => CacheKeys.LandlordDashboard(landlordId);
}
