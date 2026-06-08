namespace MyProperty.Application.Admin.Queries.GetStakeholderDashboard;

/// <summary>
/// Invite funnel. <c>Sent</c> is the total number of invites ever created;
/// <c>AcceptanceRate</c> = Accepted ÷ Sent (0 when none sent). The trend
/// buckets invites created (sent) and accepted, by month.
/// </summary>
public sealed record InviteFunnelSection(
    int Sent,
    int Accepted,
    int Rejected,
    int Expired,
    int Pending,
    decimal AcceptanceRate,
    IReadOnlyList<MonthlyInviteDto> Trend);
