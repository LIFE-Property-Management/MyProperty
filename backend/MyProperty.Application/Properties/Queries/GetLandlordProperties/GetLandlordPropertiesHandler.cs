using FluentValidation;
using MyProperty.Application.Common;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;

namespace MyProperty.Application.Properties.Queries.GetLandlordProperties;

public sealed class GetLandlordPropertiesHandler(
    IValidator<GetLandlordPropertiesQuery> validator,
    IPropertyRepository properties,
    ICurrentUserContext currentUserContext)
{
    public async Task<PagedResult<PropertyDto>> Handle(GetLandlordPropertiesQuery query, CancellationToken ct)
    {
        await validator.EnsureValidAsync(query, ct);

        var landlord = await currentUserContext.GetOrSyncUserAsync(ct);

        var (items, totalCount) = await properties.ListByLandlordAsync(
            landlord.Id, query.Page, query.PageSize, ct);

        var dtos = items.Select(p => new PropertyDto(
            p.Id, p.Name, p.Address, p.UnitNumber, p.PropertyType, p.CreatedAt)).ToList();

        return new PagedResult<PropertyDto>(dtos, query.Page, query.PageSize, totalCount);
    }
}
