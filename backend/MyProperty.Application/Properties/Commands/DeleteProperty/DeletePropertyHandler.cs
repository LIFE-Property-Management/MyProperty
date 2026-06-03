using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;

namespace MyProperty.Application.Properties.Commands.DeleteProperty;

public sealed class DeletePropertyHandler(
    IPropertyRepository properties,
    IUserRepository users,
    ICurrentUser currentUser,
    ILandlordDashboardCache dashboardCache)
{
    public async Task Handle(Guid propertyId, CancellationToken ct)
    {
        var landlord = await users.GetOrSyncFromClaimsAsync(currentUser.Principal!, ct);

        var property = await properties.GetByIdAsync(propertyId, ct)
            ?? throw new NotFoundException("Property", propertyId);

        if (property.LandlordId != landlord.Id)
            throw new ForbiddenException("You do not own this property.");

        property.DeletedAt = DateTime.UtcNow;
        await properties.SaveChangesAsync(ct);
        await dashboardCache.InvalidateAsync(landlord.Id, ct);
    }
}
