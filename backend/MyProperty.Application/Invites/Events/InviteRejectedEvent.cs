using MyProperty.Application.Common.Messaging;

namespace MyProperty.Application.Invites.Events;

/// <summary>
/// Published by <c>RejectInviteHandler</c> <b>after</b> the DB commit. A consumer
/// pushes a SignalR notification to <c>landlord:{LandlordId}</c> so the landlord
/// sees the invite was declined without a refresh. No email leg (rejection is an
/// in-app signal only — matches the <c>backend/CLAUDE.md</c> push spec).
/// </summary>
/// <remarks>
/// Routing key (derived from the type name): <c>invite.rejected</c>.
/// </remarks>
public sealed record InviteRejectedEvent(
    Guid InviteId,
    Guid LandlordId,
    Guid PropertyId,
    string PropertyName) : IIntegrationEvent;
