using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyProperty.Application.Common.Email;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Notifications;
using MyProperty.Application.Payments.Events;

namespace MyProperty.Infrastructure.Messaging.Consumers;

/// <summary>
/// Consumes <see cref="PaymentConfirmedEvent"/> and translates each one into
/// (1) a Hangfire <c>SendEmailJob</c> for the tenant's confirmation receipt
/// and (2) a SignalR push to <c>tenant:{TenantId}</c> so the tenant portal
/// flips to Confirmed without a manual refresh. This is the worked example
/// from <c>backend/CLAUDE.md</c>.
/// </summary>
public sealed class PaymentConfirmedConsumer(
    RabbitMqConnectionProvider connections,
    IServiceScopeFactory scopeFactory,
    IOptions<RabbitMqOptions> options,
    ILogger<PaymentConfirmedConsumer> logger)
    : IntegrationEventConsumerBase<PaymentConfirmedEvent>(connections, scopeFactory, options, logger)
{
    protected override string QueueName  => "myproperty.payment.confirmed.email";
    protected override string RoutingKey => "payment.confirmed";

    protected override async Task HandleAsync(
        PaymentConfirmedEvent evt, IServiceProvider services, CancellationToken ct)
    {
        var users         = services.GetRequiredService<IUserRepository>();
        var jobs          = services.GetRequiredService<IBackgroundJobQueue>();
        var notifications = services.GetRequiredService<INotificationDispatcher>();

        var tenant = await users.GetByIdAsync(evt.TenantId, ct);
        if (tenant is null)
        {
            logger.LogWarning(
                "PaymentConfirmedEvent references unknown tenant {TenantId}; acking and dropping.",
                evt.TenantId);
            return;
        }

        jobs.EnqueueEmail(BuildConfirmationEmail(tenant.Email, tenant.FirstName, evt));
        logger.LogInformation(
            "Enqueued confirmation email for payment {PaymentId} → {Email}.",
            evt.PaymentId, tenant.Email);

        await notifications.NotifyTenantPaymentConfirmedAsync(
            evt.TenantId,
            new PaymentConfirmedNotification(evt.PaymentId, evt.ConfirmedAt),
            ct);
    }

    private static EmailMessage BuildConfirmationEmail(string to, string firstName, PaymentConfirmedEvent evt)
    {
        var body = $"""
            <p>Hi {firstName},</p>
            <p>Your landlord has confirmed your payment of
            <strong>{evt.Amount:0.00} {evt.Currency}</strong> on
            {evt.ConfirmedAt:yyyy-MM-dd HH:mm} UTC.</p>
            <p>Reference: {evt.PaymentId}</p>
            <p>You can review the receipt in the tenant portal.</p>
            """;

        return new EmailMessage(
            To:      to,
            Subject: "Your payment was confirmed",
            Body:    body,
            IsHtml:  true);
    }
}
