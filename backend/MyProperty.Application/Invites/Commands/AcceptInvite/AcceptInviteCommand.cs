namespace MyProperty.Application.Invites.Commands.AcceptInvite;

public sealed record AcceptInviteCommand(string Token);

// Co-located: only exists as the handler return type.
public sealed record InviteAcceptedDto(Guid InviteId, Guid LeaseId);
