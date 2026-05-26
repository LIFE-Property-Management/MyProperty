using MyProperty.Domain.Enums;

namespace MyProperty.Application.Landlord.Queries.GetTenantDetail;

public sealed record TenantDetailDto(
    Guid TenantId,
    string Email,
    string FullName,
    string PropertyName,
    Guid LeaseId,
    DateOnly LeaseStartDate,
    DateOnly LeaseEndDate,
    decimal MonthlyRent,
    string Currency,
    LeaseStatus LeaseStatus,
    IReadOnlyList<PaymentHistoryDto> PaymentHistory);
