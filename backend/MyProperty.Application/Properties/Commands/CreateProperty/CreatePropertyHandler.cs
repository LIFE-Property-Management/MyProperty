using FluentValidation;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;
using MyProperty.Domain.Entities;

namespace MyProperty.Application.Properties.Commands.CreateProperty;

public sealed class CreatePropertyHandler(
    IValidator<CreatePropertyCommand> validator,
    IPropertyRepository properties,
    IUserRepository users,
    ICurrentUser currentUser,
    ILandlordDashboardCache dashboardCache)
{
    public async Task<PropertyCreatedDto> Handle(CreatePropertyCommand cmd, CancellationToken ct)
    {
        await validator.EnsureValidAsync(cmd, ct);
        
        var landlord = await users.GetOrSyncFromClaimsAsync(currentUser.Principal!, ct);
        
        var property = new Property
        {
            LandlordId = landlord.Id,
            Name = cmd.Name,
            Address = cmd.Address,
            UnitNumber = cmd.UnitNumber,
        };

        await properties.AddAsync(property, ct);
        await properties.SaveChangesAsync(ct);

        await dashboardCache.InvalidateAsync(landlord.Id, ct);

        return new PropertyCreatedDto(property.Id);
    }
}
