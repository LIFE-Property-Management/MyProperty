namespace MyProperty.Application.Admin.Queries.GetStakeholderDashboard;

/// <summary>
/// Growth &amp; users. Roles are not stored on <c>User</c> (they live in
/// Keycloak), so role-segmented counts are derived from domain relationships:
/// <list type="bullet">
///   <item><c>Landlords</c> = distinct landlords that own ≥1 property.</item>
///   <item><c>Tenants</c> = distinct tenants on ≥1 lease.</item>
/// </list>
/// </summary>
public sealed record GrowthSection(
    int TotalUsers,
    int Landlords,
    int Tenants,
    int NewUsersThisMonth,
    IReadOnlyList<MonthlyCountDto> UserGrowthTrend);
