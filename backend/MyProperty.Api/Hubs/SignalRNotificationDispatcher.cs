using Microsoft.AspNetCore.SignalR;
using MyProperty.Application.Common.Notifications;

namespace MyProperty.Api.Hubs;

/// <summary>
/// SignalR-backed <see cref="INotificationDispatcher"/>. Translates each
/// notification call into a group-targeted <c>SendAsync</c> on the
/// <see cref="NotificationsHub"/>. Group keys come from
/// <see cref="NotificationsHub.TenantGroup"/> / <see cref="NotificationsHub.LandlordGroup"/>
/// so the hub and the dispatcher cannot drift.
/// </summary>
/// <remarks>
/// Wire-format method names (<c>"PaymentConfirmed"</c> etc.) match the SignalR
/// client subscriptions in the frontend (<c>frontend/CLAUDE.md</c>) — renaming
/// here is a breaking change for connected browsers. Transport errors are
/// caught and logged so a flaky Redis backplane never fails a consumer's ack.
/// </remarks>
public sealed class SignalRNotificationDispatcher(
    IHubContext<NotificationsHub> hub,
    ILogger<SignalRNotificationDispatcher> logger) : INotificationDispatcher
{
    public Task NotifyTenantPaymentConfirmedAsync(
        Guid tenantId, PaymentConfirmedNotification payload, CancellationToken ct)
        => SendAsync(NotificationsHub.TenantGroup(tenantId), "PaymentConfirmed", payload, ct);

    public Task NotifyTenantPaymentRejectedAsync(
        Guid tenantId, PaymentRejectedNotification payload, CancellationToken ct)
        => SendAsync(NotificationsHub.TenantGroup(tenantId), "PaymentRejected", payload, ct);

    public Task NotifyTenantPaymentCreatedAsync(
        Guid tenantId, PaymentCreatedNotification payload, CancellationToken ct)
        => SendAsync(NotificationsHub.TenantGroup(tenantId), "PaymentCreated", payload, ct);

    public Task NotifyLandlordPaymentSubmittedAsync(
        Guid landlordId, PaymentSubmittedNotification payload, CancellationToken ct)
        => SendAsync(NotificationsHub.LandlordGroup(landlordId), "PaymentSubmitted", payload, ct);

    public Task NotifyTenantLeaseExpiringAsync(
        Guid tenantId, LeaseExpiringNotification payload, CancellationToken ct)
        => SendAsync(NotificationsHub.TenantGroup(tenantId), "LeaseExpiringSoon", payload, ct);

    private async Task SendAsync(string groupName, string method, object payload, CancellationToken ct)
    {
        try
        {
            await hub.Clients.Group(groupName).SendAsync(method, payload, ct);
            logger.LogInformation("Pushed {Method} to {Group}.", method, groupName);
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "Failed to push {Method} to {Group}. Notification dropped — DB state is unchanged.",
                method, groupName);
        }
    }
}
