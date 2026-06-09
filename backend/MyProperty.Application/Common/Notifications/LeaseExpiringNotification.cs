namespace MyProperty.Application.Common.Notifications;

/// <summary>
/// Server-to-client payload for the SignalR <c>LeaseExpiringSoon</c> event,
/// pushed to both the tenant and the landlord of a lease approaching its end date.
/// </summary>
/// <remarks>
/// Carries the related ids (mirroring <c>PaymentSubmittedNotification</c>) so a
/// landlord with many leases can render a useful signal without an extra refetch.
/// Still a signal, not the source of truth — durable delivery is the email the
/// job enqueues; the frontend treats this as a cache-invalidation/toast hint.
/// </remarks>
public sealed record LeaseExpiringNotification(
    Guid LeaseId,
    Guid PropertyId,
    Guid TenantId,
    DateOnly ExpiresAt);
