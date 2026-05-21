using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyProperty.Application.Common.Notifications;
using MyProperty.Application.Payments.Events;

namespace MyProperty.Infrastructure.Messaging.Consumers;

/// <summary>
/// Consumes <see cref="PaymentRejectedEvent"/> and pushes a SignalR
/// notification to <c>tenant:{TenantId}</c> so the tenant sees the rejection —
/// and the landlord's reason — without a manual refresh.
/// </summary>
public sealed class PaymentRejectedConsumer(
    RabbitMqConnectionProvider connections,
    IServiceScopeFactory scopeFactory,
    IOptions<RabbitMqOptions> options,
    ILogger<PaymentRejectedConsumer> logger)
    : IntegrationEventConsumerBase<PaymentRejectedEvent>(connections, scopeFactory, options, logger)
{
    protected override string QueueName => "myproperty.payment.rejected.signalr";
    protected override string RoutingKey => "payment.rejected";

    protected override Task HandleAsync(
        PaymentRejectedEvent evt, IServiceProvider services, CancellationToken ct)
    {
        var notifications = services.GetRequiredService<INotificationDispatcher>();
        return notifications.NotifyTenantPaymentRejectedAsync(
            evt.TenantId,
            new PaymentRejectedNotification(evt.PaymentId, evt.Reason, evt.RejectedAt),
            ct);
    }
}
