using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyProperty.Application.Common.Notifications;
using MyProperty.Application.Payments.Events;

namespace MyProperty.Infrastructure.Messaging.Consumers;

/// <summary>
/// Consumes <see cref="PaymentSubmittedEvent"/> and pushes a SignalR
/// notification to <c>landlord:{LandlordId}</c> so the landlord dashboard
/// surfaces the pending payment without a manual refresh. No email — landlords
/// review submissions in-app, not over email.
/// </summary>
public sealed class PaymentSubmittedConsumer(
    RabbitMqConnectionProvider connections,
    IServiceScopeFactory scopeFactory,
    IOptions<RabbitMqOptions> options,
    ILogger<PaymentSubmittedConsumer> logger)
    : IntegrationEventConsumerBase<PaymentSubmittedEvent>(connections, scopeFactory, options, logger)
{
    protected override string QueueName  => "myproperty.payment.submitted.signalr";
    protected override string RoutingKey => "payment.submitted";

    protected override Task HandleAsync(
        PaymentSubmittedEvent evt, IServiceProvider services, CancellationToken ct)
    {
        var notifications = services.GetRequiredService<INotificationDispatcher>();
        return notifications.NotifyLandlordPaymentSubmittedAsync(
            evt.LandlordId,
            new PaymentSubmittedNotification(
                evt.PaymentId, evt.TenantId, evt.LeaseId,
                evt.Amount, evt.Currency, evt.SubmittedAt),
            ct);
    }
}
