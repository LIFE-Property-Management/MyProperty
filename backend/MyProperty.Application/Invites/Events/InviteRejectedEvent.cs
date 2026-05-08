namespace MyProperty.Application.Invites.Events;

public sealed record InviteRejectedEvent(
    Guid InviteId,
    Guid LandlordId,
    DateTime RejectedAt);
