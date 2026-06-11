using FluentValidation;
using MyProperty.Application.Common;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;

namespace MyProperty.Application.Properties.Queries.GetLandlordProperties;

public sealed class GetLandlordPropertiesHandler(
    IValidator<GetLandlordPropertiesQuery> validator,
    IPropertyRepository properties,
    ILeaseRepository leases,
    IInviteRepository invites,
    ICurrentUserContext currentUserContext)
{
    public async Task<PagedResult<PropertyDto>> Handle(GetLandlordPropertiesQuery query, CancellationToken ct)
    {
        await validator.EnsureValidAsync(query, ct);

        var landlord = await currentUserContext.GetOrSyncUserAsync(ct);

        var (items, totalCount) = await properties.ListByLandlordAsync(
            landlord.Id, query.Page, query.PageSize, ct);

        // Per-property occupancy (D7): two set-based lookups for the whole page
        // rather than two existence checks per property (N+1).
        var pageIds = items.Select(p => p.Id).ToList();
        var activeLeaseIds = await leases.GetActiveLeaseIdsByPropertyAsync(pageIds, ct);
        var invited = await invites.GetPropertyIdsWithPendingInviteAsync(pageIds, ct);

        var dtos = items.Select(p => new PropertyDto(
            p.Id, p.Name, p.Address, p.UnitNumber, p.PropertyType, p.CreatedAt,
            HasActiveLease: activeLeaseIds.ContainsKey(p.Id),
            HasPendingInvite: invited.Contains(p.Id),
            ActiveLeaseId: activeLeaseIds.TryGetValue(p.Id, out var leaseId) ? leaseId : null)).ToList();

        return new PagedResult<PropertyDto>(dtos, query.Page, query.PageSize, totalCount);
    }
}
