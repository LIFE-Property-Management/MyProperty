using MyProperty.Domain.Enums;

namespace MyProperty.Application.Properties.Commands.UpdateProperty;

public sealed record UpdatePropertyCommand(
    Guid PropertyId,
    string Name,
    string Address,
    string? UnitNumber,
    PropertyType PropertyType);
