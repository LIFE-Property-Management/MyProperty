using FluentValidation;
using MyProperty.Application.Common;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;

namespace MyProperty.Application.Leases.Queries.GetLandlordLeases;

public sealed class GetLandlordLeasesHandler(
    IValidator<GetLandlordLeasesQuery> validator,
    ILeaseRepository leases,
    ICurrentUserContext currentUserContext)
{
    public async Task<PagedResult<LeaseDto>> Handle(GetLandlordLeasesQuery query, CancellationToken ct)
    {
        await validator.EnsureValidAsync(query, ct);

        var landlord = await currentUserContext.GetOrSyncUserAsync(ct);

        var (items, totalCount) = await leases.ListByLandlordAsync(
            landlord.Id, query.Page, query.PageSize, ct);

        // Property is always loaded via Include in ListByLandlordAsync
        // Tenant is always loaded via Include in ListByLandlordAsync
        var dtos = items.Select(l => new LeaseDto(
            l.Id,
            l.PropertyId,
            l.Property!.Name,
            l.TenantId,
            l.Tenant!.Email,
            l.StartDate,
            l.EndDate,
            l.MonthlyRent,
            l.Currency,
            l.Status)).ToList();

        return new PagedResult<LeaseDto>(dtos, query.Page, query.PageSize, totalCount);
    }
}
