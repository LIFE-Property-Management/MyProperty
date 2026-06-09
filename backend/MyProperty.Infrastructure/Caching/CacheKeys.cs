namespace MyProperty.Infrastructure.Caching;

/// <summary>
/// Central definition of the logical cache-key conventions. Both the production
/// cache (<see cref="RedisLandlordDashboardCache"/>) and the integration test
/// eviction helper resolve keys here so they cannot drift apart.
/// </summary>
public static class CacheKeys
{
    public static string LandlordDashboard(Guid landlordId) => $"landlord:{landlordId}:dashboard";

    public static string StakeholderDashboard() => "admin:stakeholder:dashboard";
}
