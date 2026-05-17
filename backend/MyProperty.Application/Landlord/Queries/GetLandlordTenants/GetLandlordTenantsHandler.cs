using FluentValidation;
using MyProperty.Application.Common;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;

namespace MyProperty.Application.Landlord.Queries.GetLandlordTenants;

public sealed class GetLandlordTenantsHandler(
    IValidator<GetLandlordTenantsQuery> validator,
    ILeaseRepository leaseRepo)
{
    public async Task<PagedResult<LandlordTenantDto>> Handle(GetLandlordTenantsQuery query, CancellationToken ct)
    {
        await validator.EnsureValidAsync(query, ct);

        var (items, totalCount) = await leaseRepo.ListByLandlordAsync(
            query.LandlordId, query.Page, query.PageSize, ct);

        var dtos = items.Select(l => new LandlordTenantDto(
            l.TenantId,
            l.Tenant!.Email,
            l.Tenant.FirstName,
            l.Tenant.LastName,
            l.Property!.Name,
            l.Status,
            l.EndDate)).ToList();

        return new PagedResult<LandlordTenantDto>(dtos, query.Page, query.PageSize, totalCount);
    }
}
