namespace MyProperty.Application.Properties.Commands.CreateProperty;

public sealed record CreatePropertyCommand(
    Guid LandlordId,
    string Name,
    string Address,
    string? UnitNumber);
