namespace MyProperty.Application.Admin.Queries.GetStakeholderDashboard;

/// <summary>
/// System-wide business KPIs for the stakeholder (product-lead) dashboard.
/// Composes the five metric sections plus a 12-month trend per relevant series.
/// Cached server-side (see <c>IStakeholderDashboardCache</c>) because the
/// underlying query fans out across users, properties, leases, invites and
/// payments. <c>GeneratedAt</c> is the freshness sentinel (mirrors the
/// landlord DTO) — two reads with the same value indicate a cache hit.
/// </summary>
public sealed record StakeholderDashboardDto(
    GrowthSection Growth,
    AdoptionSection Adoption,
    InviteFunnelSection InviteFunnel,
    FinancialSection Financial,
    SystemHealthSection SystemHealth,
    DateTime GeneratedAt);
