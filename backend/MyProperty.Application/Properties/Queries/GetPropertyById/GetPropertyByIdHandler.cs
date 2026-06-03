using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;

namespace MyProperty.Application.Properties.Queries.GetPropertyById;

public sealed class GetPropertyByIdHandler(IPropertyRepository properties)
{
    public async Task<PropertyDetailDto> Handle(GetPropertyByIdQuery query, CancellationToken ct)
    {
        return await properties.GetDetailAsync(query.PropertyId, query.LandlordId, ct)
            ?? throw new NotFoundException("Property", query.PropertyId);
    }
}
