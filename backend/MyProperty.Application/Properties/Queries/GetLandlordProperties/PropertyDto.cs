namespace MyProperty.Application.Properties.Queries.GetLandlordProperties;

public sealed record PropertyDto(
    Guid Id,
    string Name,
    string Address,
    string? UnitNumber,
    DateTime CreatedAt);
