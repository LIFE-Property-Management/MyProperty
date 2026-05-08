namespace MyProperty.Application.Invites.Events;

public sealed record InviteAcceptedEvent(
    Guid InviteId,
    Guid LeaseId,
    Guid TenantId,
    Guid LandlordId,
    DateTime AcceptedAt);
