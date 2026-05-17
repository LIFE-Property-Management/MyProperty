using FluentValidation;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;
using MyProperty.Domain.Entities;

namespace MyProperty.Application.Properties.Commands.CreateProperty;

public sealed class CreatePropertyHandler(
    IValidator<CreatePropertyCommand> validator,
    IPropertyRepository propertyRepo,
    ILandlordDashboardCache dashboardCache)
{
    public async Task<PropertyCreatedDto> Handle(CreatePropertyCommand cmd, CancellationToken ct)
    {
        await validator.EnsureValidAsync(cmd, ct);

        var property = new Property
        {
            LandlordId = cmd.LandlordId,
            Name = cmd.Name,
            Address = cmd.Address,
            UnitNumber = cmd.UnitNumber,
        };

        await propertyRepo.AddAsync(property, ct);
        await propertyRepo.SaveChangesAsync(ct);

        await dashboardCache.InvalidateAsync(cmd.LandlordId, ct);

        return new PropertyCreatedDto(property.Id);
    }
}
