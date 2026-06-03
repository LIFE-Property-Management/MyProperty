namespace MyProperty.Application.Invites.Commands.AcceptInvite;

public sealed record AcceptInviteCommand(
    string Token,
    string FirstName,
    string LastName,
    string? Phone,
    string Password);

/// <summary>JSON body for POST /invites/{token}/accept — token comes from the route.</summary>
public sealed record AcceptInviteBody(
    string FirstName,
    string LastName,
    string? Phone,
    string Password);

// Co-located: only exists as the handler return type.
public sealed record InviteAcceptedDto(Guid InviteId, Guid LeaseId);
