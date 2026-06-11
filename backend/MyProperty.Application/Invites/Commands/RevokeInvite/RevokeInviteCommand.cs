namespace MyProperty.Application.Invites.Commands.RevokeInvite;

/// <summary>
/// Landlord cancels one of their own invites. Only a Pending (or naturally
/// Expired) invite can be revoked; the invite transitions to
/// <see cref="Domain.Enums.InviteStatus.Revoked"/>.
/// </summary>
public sealed record RevokeInviteCommand(Guid InviteId);
