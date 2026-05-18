namespace MyProperty.Application.Leases.Queries.GetLeasesExpiringSoon;

public sealed record ExpiringLeaseDto(
    Guid Id,
    Guid PropertyId,
    string PropertyName,
    Guid TenantId,
    string TenantEmail,
    string TenantFirstName,
    string TenantLastName,
    DateOnly EndDate,
    int DaysUntilExpiry);
