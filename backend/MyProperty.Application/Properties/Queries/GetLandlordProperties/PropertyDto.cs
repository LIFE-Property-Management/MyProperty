using MyProperty.Domain.Enums;

namespace MyProperty.Application.Properties.Queries.GetLandlordProperties;

public sealed record PropertyDto(
    Guid Id,
    string Name,
    string Address,
    string? UnitNumber,
    PropertyType PropertyType,
    DateTime CreatedAt,
    bool HasActiveLease,
    bool HasPendingInvite,
    // The Active lease's id when HasActiveLease is true (null otherwise). Drives the
    // landlord "Cancel lease" action (PATCH /leases/{id}/terminate) without a second
    // round-trip. Unambiguous thanks to the single-active-lease-per-property invariant.
    Guid? ActiveLeaseId);
