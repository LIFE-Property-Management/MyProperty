namespace MyProperty.Application.Landlord.Queries.GetUpcomingPayments;

public sealed record UpcomingPaymentDto(
    Guid Id,
    Guid TenantId,
    string TenantName,
    string Property,
    decimal Amount,
    string Currency,
    DateOnly DueDate);
