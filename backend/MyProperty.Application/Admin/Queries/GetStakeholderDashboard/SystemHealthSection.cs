namespace MyProperty.Application.Admin.Queries.GetStakeholderDashboard;

/// <summary>
/// System health — surfaced as a small line, not a headline KPI. Counts the
/// dead-lettered <c>FailedEmail</c> records (total and this calendar month).
/// </summary>
public sealed record SystemHealthSection(
    int FailedEmailsTotal,
    int FailedEmailsThisMonth);
