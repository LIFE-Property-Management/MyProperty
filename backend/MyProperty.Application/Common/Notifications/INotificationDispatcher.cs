namespace MyProperty.Application.Common.Notifications;

/// <summary>
/// Sends server-push notifications to connected clients. The Application layer
/// depends on this abstraction; the Api layer wires it to SignalR's
/// <c>IHubContext&lt;NotificationsHub&gt;</c>. Consumers in Infrastructure
/// fan-out RabbitMQ events through these methods.
/// </summary>
/// <remarks>
/// <para>
/// Methods take the destination <see cref="Guid"/> (internal user id) — the
/// dispatcher implementation is responsible for translating that into the
/// SignalR group key (e.g. <c>tenant:{userId}</c>). Callers do not know about
/// SignalR.
/// </para>
/// <para>
/// Implementations should swallow transport-level failures rather than throw —
/// notifications are signals, not the source of truth. The DB row is the
/// durable record; a missed push means a missed UI animation, not a missed
/// state change. The frontend will pick up the truth on its next poll or
/// page navigation.
/// </para>
/// </remarks>
public interface INotificationDispatcher
{
    Task NotifyTenantPaymentConfirmedAsync(
        Guid tenantId, PaymentConfirmedNotification payload, CancellationToken ct);

    Task NotifyTenantPaymentRejectedAsync(
        Guid tenantId, PaymentRejectedNotification payload, CancellationToken ct);

    Task NotifyTenantPaymentCreatedAsync(
        Guid tenantId, PaymentCreatedNotification payload, CancellationToken ct);

    Task NotifyLandlordPaymentSubmittedAsync(
        Guid landlordId, PaymentSubmittedNotification payload, CancellationToken ct);
}
