using MyProperty.Domain.Enums;

namespace MyProperty.Application.Properties.Commands.CreateProperty;

public sealed record CreatePropertyCommand(
    string Name,
    string Address,
    string? UnitNumber,
    PropertyType PropertyType);
