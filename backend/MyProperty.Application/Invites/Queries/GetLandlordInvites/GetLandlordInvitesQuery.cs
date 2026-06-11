using MyProperty.Domain.Enums;

namespace MyProperty.Application.Invites.Queries.GetLandlordInvites;

/// <summary>
/// Lists the calling landlord's invites, newest first, with optional status
/// filtering. Landlord-scoped: the handler resolves the landlord from the JWT,
/// never from the query.
/// </summary>
public sealed record GetLandlordInvitesQuery(int Page, int PageSize, InviteStatus? StatusFilter);
