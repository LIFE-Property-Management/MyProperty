using MyProperty.Application.Invites.Commands.AcceptInvite;

namespace MyProperty.Application.Invites.Commands.ClaimInvite;

/// <summary>
/// Authenticated accept of an invite by a returning tenant who already has an
/// account. The token comes from the route; identity comes from the JWT. No
/// Keycloak provisioning happens — the existing account is reused. Returns
/// <see cref="InviteAcceptedDto"/> (shared with the anonymous accept path).
/// </summary>
public sealed record ClaimInviteCommand(string Token);
