namespace MyProperty.Application.Admin.Queries.GetStakeholderDashboard;

/// <summary>A single month bucket in the invite funnel trend: invites sent vs accepted.</summary>
public sealed record MonthlyInviteDto(int Year, int Month, int Sent, int Accepted);
