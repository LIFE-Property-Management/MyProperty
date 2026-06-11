using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyProperty.Application.Common.Email;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Notifications;
using MyProperty.Application.Invites.Events;

namespace MyProperty.Infrastructure.Messaging.Consumers;

/// <summary>
/// Consumes <see cref="InviteAcceptedEvent"/> and fans it out to the landlord:
/// (1) a Hangfire-queued notification email and (2) a SignalR push to
/// <c>landlord:{LandlordId}</c> so the dashboard surfaces the acceptance without
/// a manual refresh. Mirrors <c>PaymentConfirmedConsumer</c> (email + SignalR).
/// </summary>
public sealed class InviteAcceptedConsumer(
    RabbitMqConnectionProvider connections,
    IServiceScopeFactory scopeFactory,
    IOptions<RabbitMqOptions> options,
    ILogger<InviteAcceptedConsumer> logger)
    : IntegrationEventConsumerBase<InviteAcceptedEvent>(connections, scopeFactory, options, logger)
{
    protected override string QueueName => "myproperty.invite.accepted.landlord";
    protected override string RoutingKey => "invite.accepted";

    protected override async Task HandleAsync(
        InviteAcceptedEvent evt, IServiceProvider services, CancellationToken ct)
    {
        var users = services.GetRequiredService<IUserRepository>();
        var jobs = services.GetRequiredService<IBackgroundJobQueue>();
        var notifications = services.GetRequiredService<INotificationDispatcher>();

        var landlord = await users.GetByIdAsync(evt.LandlordId, ct);
        if (landlord is null)
        {
            logger.LogWarning(
                "InviteAcceptedEvent references unknown landlord {LandlordId}; acking and dropping.",
                evt.LandlordId);
            return;
        }

        jobs.EnqueueEmail(BuildAcceptedEmail(landlord.Email, landlord.FirstName, evt));
        logger.LogInformation(
            "Enqueued invite-accepted email for invite {InviteId} → {Email}.",
            evt.InviteId, landlord.Email);

        await notifications.NotifyLandlordInviteAcceptedAsync(
            evt.LandlordId,
            new InviteAcceptedNotification(evt.InviteId, evt.TenantId, evt.TenantName),
            ct);
    }

    private static EmailMessage BuildAcceptedEmail(string to, string firstName, InviteAcceptedEvent evt)
    {
        var body = $"""
            <p>Hi {firstName},</p>
            <p><strong>{evt.TenantName}</strong> has accepted your invite for
            <strong>{evt.PropertyName}</strong>. A lease has been created and the
            tenant can now begin payments.</p>
            <p>You can review the lease in your landlord portal.</p>
            """;

        return new EmailMessage(
            To: to,
            Subject: $"{evt.TenantName} accepted your invite for {evt.PropertyName}",
            Body: body,
            IsHtml: true);
    }
}
