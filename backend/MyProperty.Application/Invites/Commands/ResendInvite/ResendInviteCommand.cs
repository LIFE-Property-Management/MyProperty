namespace MyProperty.Application.Invites.Commands.ResendInvite;

/// <summary>
/// Landlord re-issues a Pending or Expired invite: a fresh token is generated
/// (the old link stops working), the expiry window is reset, the invite returns
/// to <see cref="Domain.Enums.InviteStatus.Pending"/>, and the invite email is
/// re-enqueued.
/// </summary>
public sealed record ResendInviteCommand(Guid InviteId);

// Co-located: only exists as the handler return type.
public sealed record InviteResentDto(Guid InviteId, DateTime ExpiresAt);
