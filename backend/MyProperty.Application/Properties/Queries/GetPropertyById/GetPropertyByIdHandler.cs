using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;

namespace MyProperty.Application.Properties.Queries.GetPropertyById;

public sealed class GetPropertyByIdHandler(
    IPropertyRepository properties,
    ICurrentUserContext currentUserContext)
{
    public async Task<PropertyDetailDto> Handle(GetPropertyByIdQuery query, CancellationToken ct)
    {
        var landlord = await currentUserContext.GetOrSyncUserAsync(ct);
        return await properties.GetDetailAsync(query.PropertyId, landlord.Id, ct)
            ?? throw new NotFoundException("Property", query.PropertyId);
    }
}
