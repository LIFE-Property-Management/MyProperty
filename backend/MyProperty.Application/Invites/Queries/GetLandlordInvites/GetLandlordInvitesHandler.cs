using FluentValidation;
using MyProperty.Application.Common;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;

namespace MyProperty.Application.Invites.Queries.GetLandlordInvites;

public sealed class GetLandlordInvitesHandler(
    IValidator<GetLandlordInvitesQuery> validator,
    IInviteRepository invites,
    ICurrentUserContext currentUserContext)
{
    public async Task<PagedResult<InviteListItemDto>> Handle(
        GetLandlordInvitesQuery query, CancellationToken ct)
    {
        await validator.EnsureValidAsync(query, ct);

        var landlord = await currentUserContext.GetOrSyncUserAsync(ct);

        var (items, totalCount) = await invites.ListByLandlordAsync(
            landlord.Id, query.Page, query.PageSize, query.StatusFilter, ct);

        // Property is always loaded via Include in ListByLandlordAsync.
        var dtos = items.Select(i => new InviteListItemDto(
            i.Id,
            i.PropertyId,
            i.Property!.Name,
            i.Email,
            i.FirstName,
            i.LastName,
            i.Status,
            i.ExpiresAt,
            i.CreatedAt)).ToList();

        return new PagedResult<InviteListItemDto>(dtos, query.Page, query.PageSize, totalCount);
    }
}
