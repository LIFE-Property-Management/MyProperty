using MyProperty.Domain.Enums;

namespace MyProperty.Application.Leases.Queries.GetLandlordLeases;

public sealed record LeaseDto(
    Guid Id,
    Guid PropertyId,
    string PropertyName,
    Guid TenantId,
    string TenantEmail,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal MonthlyRent,
    string Currency,
    LeaseStatus Status);
