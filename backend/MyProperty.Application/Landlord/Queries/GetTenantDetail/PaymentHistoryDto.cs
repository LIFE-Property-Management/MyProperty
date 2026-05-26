using MyProperty.Domain.Enums;

namespace MyProperty.Application.Landlord.Queries.GetTenantDetail;

public sealed record PaymentHistoryDto(
    Guid Id,
    decimal Amount,
    string Currency,
    DateOnly DueDate,
    PaymentStatus Status,
    DateTime? SubmittedAt,
    DateTime? ConfirmedAt,
    DateTime? RejectedAt);
