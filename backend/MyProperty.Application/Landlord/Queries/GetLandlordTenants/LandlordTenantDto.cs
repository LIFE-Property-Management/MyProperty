using MyProperty.Domain.Enums;

namespace MyProperty.Application.Landlord.Queries.GetLandlordTenants;

public sealed record LandlordTenantDto(
    Guid TenantId,
    string Email,
    string FirstName,
    string LastName,
    string PropertyName,
    LeaseStatus LeaseStatus,
    DateOnly LeaseEndDate);
