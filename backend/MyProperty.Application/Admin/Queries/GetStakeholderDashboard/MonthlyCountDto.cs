namespace MyProperty.Application.Admin.Queries.GetStakeholderDashboard;

/// <summary>A single month bucket in a count-based trend (e.g. new users, new leases).</summary>
public sealed record MonthlyCountDto(int Year, int Month, int Count);
