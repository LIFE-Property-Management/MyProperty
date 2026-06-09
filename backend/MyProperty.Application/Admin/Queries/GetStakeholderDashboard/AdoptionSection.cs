namespace MyProperty.Application.Admin.Queries.GetStakeholderDashboard;

/// <summary>
/// Adoption &amp; occupancy. <c>OccupancyRate</c> is a 0–1 decimal
/// (distinct properties with an active lease ÷ total properties; 0 when there
/// are no properties); the frontend formats it as a percentage.
/// <c>LeasesExpiringSoon</c> counts active leases ending within 30 days.
/// </summary>
public sealed record AdoptionSection(
    int TotalProperties,
    int ActiveLeases,
    decimal OccupancyRate,
    int LeasesExpiringSoon,
    int NewLeasesThisMonth,
    IReadOnlyList<MonthlyCountDto> LeaseGrowthTrend);
