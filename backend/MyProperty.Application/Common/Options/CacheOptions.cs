using System.ComponentModel.DataAnnotations;

namespace MyProperty.Application.Common.Options;

public sealed class CacheOptions
{
    public const string SectionName = "Cache";

    /// <summary>
    /// Redis connection string (StackExchange.Redis format). Required.
    /// Example dev value: <c>localhost:6379</c>.
    /// </summary>
    [Required]
    public required string RedisConnection { get; set; }

    /// <summary>
    /// Optional logical key prefix applied by the Redis cache implementation.
    /// Lets multiple environments share a single Redis instance without key
    /// collisions. Empty string means no prefix.
    /// </summary>
    public string InstancePrefix { get; set; } = "myproperty:";

    /// <summary>
    /// TTL applied to landlord-dashboard cache entries. 60 s matches the
    /// rate at which dashboard data is polled by the landlord portal — long
    /// enough to absorb burst traffic on a single page load, short enough
    /// that explicit invalidation isn't strictly required for correctness.
    /// </summary>
    [Range(1, 3600)]
    public int LandlordDashboardTtlSeconds { get; set; } = 60;
}
