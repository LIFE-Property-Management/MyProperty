namespace MyProperty.Application.Admin.Queries.GetStakeholderDashboard;

/// <summary>A single month bucket of confirmed revenue, scoped to one currency.</summary>
public sealed record MonthlyCurrencyAmountDto(string Currency, int Year, int Month, decimal Total);
