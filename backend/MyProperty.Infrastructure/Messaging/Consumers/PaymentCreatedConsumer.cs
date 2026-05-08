using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyProperty.Application.Common.Notifications;
using MyProperty.Application.Payments.Events;

namespace MyProperty.Infrastructure.Messaging.Consumers;

/// <summary>
/// Consumes <see cref="PaymentCreatedEvent"/> and pushes a SignalR notification
/// to <c>tenant:{TenantId}</c> so the new outstanding payment row appears on
/// the tenant dashboard without a manual refresh.
/// </summary>
public sealed class PaymentCreatedConsumer(
    RabbitMqConnectionProvider connections,
    IServiceScopeFactory scopeFactory,
    IOptions<RabbitMqOptions> options,
    ILogger<PaymentCreatedConsumer> logger)
    : IntegrationEventConsumerBase<PaymentCreatedEvent>(connections, scopeFactory, options, logger)
{
    protected override string QueueName  => "myproperty.payment.created.signalr";
    protected override string RoutingKey => "payment.created";

    protected override Task HandleAsync(
        PaymentCreatedEvent evt, IServiceProvider services, CancellationToken ct)
    {
        var notifications = services.GetRequiredService<INotificationDispatcher>();
        return notifications.NotifyTenantPaymentCreatedAsync(
            evt.TenantId,
            new PaymentCreatedNotification(
                evt.PaymentId, evt.Amount, evt.Currency, evt.DueDate),
            ct);
    }
}
