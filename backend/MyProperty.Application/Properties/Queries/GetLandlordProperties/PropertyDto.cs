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
    bool HasPendingInvite);
