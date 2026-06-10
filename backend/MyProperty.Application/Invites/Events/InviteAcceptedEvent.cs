using MyProperty.Application.Common.Messaging;

namespace MyProperty.Application.Invites.Events;

/// <summary>
/// Published by the invite-accept handlers (<c>AcceptInviteHandler</c> for new
/// users, <c>ClaimInviteHandler</c> for returning tenants) <b>after</b> the DB
/// commit. A consumer fans it out to the landlord: a SignalR push to
/// <c>landlord:{LandlordId}</c> plus a notification email.
/// </summary>
/// <remarks>
/// Routing key (derived from the type name): <c>invite.accepted</c>. The type
/// name is part of the public contract — renaming it is a breaking change for
/// consumers. <c>TenantName</c> is denormalized onto the payload so the consumer
/// can build the email/push without a DB round-trip for the tenant.
/// </remarks>
public sealed record InviteAcceptedEvent(
    Guid InviteId,
    Guid LandlordId,
    Guid PropertyId,
    string PropertyName,
    Guid TenantId,
    string TenantName) : IIntegrationEvent;
