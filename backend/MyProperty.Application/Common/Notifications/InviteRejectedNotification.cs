namespace MyProperty.Application.Common.Notifications;

/// <summary>
/// Server-to-client payload for the SignalR <c>InviteRejected</c> event, pushed
/// to the landlord whose invite was declined. Carries only the invite id — the
/// client invalidates and refetches (matches the <c>backend/CLAUDE.md</c> contract).
/// </summary>
public sealed record InviteRejectedNotification(Guid InviteId);
