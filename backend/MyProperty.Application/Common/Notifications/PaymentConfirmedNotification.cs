namespace MyProperty.Application.Common.Notifications;

/// <summary>
/// Server-to-client payload for the SignalR <c>PaymentConfirmed</c> event,
/// pushed to the tenant whose payment was just confirmed by their landlord.
/// </summary>
/// <remarks>
/// Minimal by design — the frontend uses this as a signal to invalidate the
/// relevant TanStack Query keys and refetch authoritative data from the REST
/// API. The hub is not the source of truth.
/// </remarks>
public sealed record PaymentConfirmedNotification(
    Guid PaymentId,
    DateTime ConfirmedAt);
