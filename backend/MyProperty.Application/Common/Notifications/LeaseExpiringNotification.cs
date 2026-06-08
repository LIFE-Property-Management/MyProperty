namespace MyProperty.Application.Common.Notifications;

/// <summary>
/// Server-to-client payload for the SignalR <c>LeaseExpiringSoon</c> event,
/// pushed to the tenant whose lease is approaching its end date.
/// </summary>
/// <remarks>
/// Minimal by design — the frontend uses this as a signal to invalidate the
/// relevant TanStack Query keys and refetch authoritative data from the REST
/// API. The hub is not the source of truth.
/// </remarks>
public sealed record LeaseExpiringNotification(
    Guid LeaseId,
    DateOnly ExpiresAt);