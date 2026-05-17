using FluentValidation;
using MyProperty.Application.Common;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;

namespace MyProperty.Application.Leases.Queries.GetLandlordLeases;

public sealed class GetLandlordLeasesHandler(
    IValidator<GetLandlordLeasesQuery> validator,
    ILeaseRepository leaseRepo)
{
    public async Task<PagedResult<LeaseDto>> Handle(GetLandlordLeasesQuery query, CancellationToken ct)
    {
        await validator.EnsureValidAsync(query, ct);

        var (items, totalCount) = await leaseRepo.ListByLandlordAsync(
            query.LandlordId, query.Page, query.PageSize, ct);

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
