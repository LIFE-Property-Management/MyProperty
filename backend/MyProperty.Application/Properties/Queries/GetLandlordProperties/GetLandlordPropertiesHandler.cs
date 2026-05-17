using FluentValidation;
using MyProperty.Application.Common;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;

namespace MyProperty.Application.Properties.Queries.GetLandlordProperties;

public sealed class GetLandlordPropertiesHandler(
    IValidator<GetLandlordPropertiesQuery> validator,
    IPropertyRepository propertyRepo)
{
    public async Task<PagedResult<PropertyDto>> Handle(GetLandlordPropertiesQuery query, CancellationToken ct)
    {
        await validator.EnsureValidAsync(query, ct);

        var (items, totalCount) = await propertyRepo.ListByLandlordAsync(
            query.LandlordId, query.Page, query.PageSize, ct);

        var dtos = items.Select(p => new PropertyDto(
            p.Id, p.Name, p.Address, p.UnitNumber, p.CreatedAt)).ToList();

        return new PagedResult<PropertyDto>(dtos, query.Page, query.PageSize, totalCount);
    }
}
