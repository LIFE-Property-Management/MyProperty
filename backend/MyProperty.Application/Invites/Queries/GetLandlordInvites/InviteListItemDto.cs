using MyProperty.Domain.Enums;

namespace MyProperty.Application.Invites.Queries.GetLandlordInvites;

/// <summary>
/// One row in the landlord's invite-management list. <c>Status</c> serializes as
/// a string (global <c>JsonStringEnumConverter</c>) — values include
/// <c>Revoked</c> (landlord-cancelled) alongside Pending/Accepted/Rejected/Expired.
/// </summary>
public sealed record InviteListItemDto(
    Guid Id,
    Guid PropertyId,
    string PropertyName,
    string Email,
    string FirstName,
    string LastName,
    InviteStatus Status,
    DateTime ExpiresAt,
    DateTime CreatedAt);
