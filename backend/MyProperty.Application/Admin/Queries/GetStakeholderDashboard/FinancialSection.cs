namespace MyProperty.Application.Admin.Queries.GetStakeholderDashboard;

/// <summary>
/// Financial &amp; operations, grouped BY currency (<c>Payment.Currency</c>
/// exists) — totals are never summed across currencies.
/// <list type="bullet">
///   <item><c>ConfirmationRate</c> = Confirmed ÷ (Confirmed + Rejected), 0 when none.</item>
///   <item><c>AvgHoursToConfirm</c> = mean (ConfirmedAt − SubmittedAt) over confirmed
///   payments, in whole-ish hours (decimal).</item>
///   <item><c>RevenueTrend</c> = monthly confirmed revenue per currency, bucketed by
///   <c>ConfirmedAt</c>.</item>
/// </list>
/// </summary>
public sealed record FinancialSection(
    IReadOnlyList<CurrencyTotalsDto> ByCurrency,
    decimal ConfirmationRate,
    decimal AvgHoursToConfirm,
    IReadOnlyList<MonthlyCurrencyAmountDto> RevenueTrend);
