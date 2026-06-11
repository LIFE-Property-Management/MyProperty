namespace MyProperty.Application.Common.Notifications;

/// <summary>
/// Server-to-client payload for the SignalR <c>InviteAccepted</c> event, pushed
/// to the landlord whose invite was just accepted. Minimal by design (matches
/// the <c>backend/CLAUDE.md</c> contract) — the client uses it as a signal to
/// invalidate its invite/property queries and refetch authoritative data.
/// </summary>
public sealed record InviteAcceptedNotification(
    Guid InviteId,
    Guid TenantId,
    string TenantName);
