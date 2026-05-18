using MyProperty.Domain.Enums;

namespace MyProperty.Application.Leases.Queries.GetTenantLease;

public sealed record TenantLeaseDto(
    Guid Id,
    string PropertyName,
    string LandlordName,
    DateOnly StartDate,
    DateOnly EndDate,
    decimal MonthlyRent,
    string Currency,
    LeaseStatus Status);
