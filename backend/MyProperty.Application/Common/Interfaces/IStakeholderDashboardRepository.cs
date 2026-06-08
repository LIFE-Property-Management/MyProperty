using MyProperty.Application.Admin.Queries.GetStakeholderDashboard;

namespace MyProperty.Application.Common.Interfaces;

/// <summary>
/// Read-only repository that aggregates the system-wide stakeholder-dashboard
/// metrics from the database. The shape mirrors <see cref="StakeholderDashboardDto"/>
/// exactly — the handler layers caching on top, the repository just runs the query.
/// </summary>
public interface IStakeholderDashboardRepository
{
    Task<StakeholderDashboardDto> GetAsync(CancellationToken ct);
}
