using FluentValidation;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;

namespace MyProperty.Application.Properties.Commands.UpdateProperty;

public sealed class UpdatePropertyHandler(
    IValidator<UpdatePropertyCommand> validator,
    IPropertyRepository properties,
    ICurrentUserContext currentUserContext,
    ILandlordDashboardCache dashboardCache)
{
    public async Task Handle(UpdatePropertyCommand cmd, CancellationToken ct)
    {
        await validator.EnsureValidAsync(cmd, ct);

        var landlord = await currentUserContext.GetOrSyncUserAsync(ct);

        var property = await properties.GetByIdAsync(cmd.PropertyId, ct)
            ?? throw new NotFoundException("Property", cmd.PropertyId);

        if (property.LandlordId != landlord.Id)
            throw new ForbiddenException("You do not own this property.");

        property.Name = cmd.Name;
        property.Address = cmd.Address;
        property.UnitNumber = cmd.UnitNumber;
        property.PropertyType = cmd.PropertyType;

        await properties.SaveChangesAsync(ct);
        await dashboardCache.InvalidateAsync(landlord.Id, ct);
    }
}
