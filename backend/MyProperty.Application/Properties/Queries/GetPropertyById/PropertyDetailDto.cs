using MyProperty.Domain.Enums;

namespace MyProperty.Application.Properties.Queries.GetPropertyById;

public sealed record PropertyTenantDto(
    Guid LeaseId,
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
    // The pending invite's id when HasPendingInvite is true (null otherwise). Drives
    // the landlord "Cancel invitation" action (POST /invites/{id}/revoke) inline.
    // TODO(guard rail): returned as if the property has a single pending invite — the
    // one-pending-invite-per-property invariant is NOT yet enforced. See PropertyDto.
    Guid? PendingInviteId,
    IReadOnlyList<PropertyTenantDto> Tenants);
