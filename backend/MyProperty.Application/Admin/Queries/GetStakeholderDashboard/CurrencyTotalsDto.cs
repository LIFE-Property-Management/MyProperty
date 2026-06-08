namespace MyProperty.Application.Admin.Queries.GetStakeholderDashboard;

/// <summary>
/// Payment totals for a single currency. Amounts are NEVER summed across
/// currencies into one figure — each currency stands alone.
/// </summary>
public sealed record CurrencyTotalsDto(
    string Currency,
    decimal Confirmed,
    decimal Pending,
    decimal Outstanding,
    decimal Overdue);
