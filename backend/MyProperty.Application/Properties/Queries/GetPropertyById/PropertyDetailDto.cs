using MyProperty.Domain.Enums;

namespace MyProperty.Application.Properties.Queries.GetPropertyById;

public sealed record PropertyTenantDto(
    Guid TenantId,
    string FullName,
    string Email,
    DateOnly LeaseStart,
    DateOnly LeaseEnd,
    decimal MonthlyRent,
    string Currency,
    string LeaseStatus);

public sealed record PropertyDetailDto(
    Guid Id,
    string Name,
    string Address,
    string? UnitNumber,
    PropertyType PropertyType,
    DateTime CreatedAt,
    bool HasActiveLease,
    bool HasPendingInvite,
    IReadOnlyList<PropertyTenantDto> Tenants);
