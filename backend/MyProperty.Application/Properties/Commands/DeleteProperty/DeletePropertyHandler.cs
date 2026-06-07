using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;

namespace MyProperty.Application.Properties.Commands.DeleteProperty;

public sealed class DeletePropertyHandler(
    IPropertyRepository properties,
    ILeaseRepository leases,
    ICurrentUserContext currentUserContext,
    ILandlordDashboardCache dashboardCache)
{
    public async Task Handle(Guid propertyId, CancellationToken ct)
    {
        var landlord = await currentUserContext.GetOrSyncUserAsync(ct);

        var property = await properties.GetByIdAsync(propertyId, ct)
            ?? throw new NotFoundException("Property", propertyId);

        if (property.LandlordId != landlord.Id)
            throw new ForbiddenException("You do not own this property.");

        if (await leases.HasActiveLeaseForPropertyAsync(propertyId, ct))
            throw new ConflictException(
                "This property has active leases. Terminate or reassign them before deleting.");

        property.DeletedAt = DateTime.UtcNow;
        await properties.SaveChangesAsync(ct);
        await dashboardCache.InvalidateAsync(landlord.Id, ct);
    }
}
