namespace MyProperty.Application.Landlord.Queries.GetLandlordDashboard;

/// <summary>
/// Aggregate counters for the landlord-portal dashboard. Cached server-side
/// (M3.5 — see <c>ILandlordDashboardCache</c>) because the underlying query
/// fans out across properties, leases and payments.
/// </summary>
public sealed record LandlordDashboardDto(
    int TotalProperties,
    int ActiveLeases,
    int ActiveTenants,
    int PendingPayments,
    int OverduePayments,
    DateTime GeneratedAt);
