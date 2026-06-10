using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyProperty.Application.Common.Notifications;
using MyProperty.Application.Invites.Events;

namespace MyProperty.Infrastructure.Messaging.Consumers;

/// <summary>
/// Consumes <see cref="InviteRejectedEvent"/> and pushes a SignalR notification
/// to <c>landlord:{LandlordId}</c> so the landlord sees the invite was declined
/// without a manual refresh. No email leg — rejection is an in-app signal only
/// (matches the <c>backend/CLAUDE.md</c> push spec, mirrors
/// <c>PaymentSubmittedConsumer</c>).
/// </summary>
public sealed class InviteRejectedConsumer(
    RabbitMqConnectionProvider connections,
    IServiceScopeFactory scopeFactory,
    IOptions<RabbitMqOptions> options,
    ILogger<InviteRejectedConsumer> logger)
    : IntegrationEventConsumerBase<InviteRejectedEvent>(connections, scopeFactory, options, logger)
{
    protected override string QueueName => "myproperty.invite.rejected.landlord";
    protected override string RoutingKey => "invite.rejected";

    protected override Task HandleAsync(
        InviteRejectedEvent evt, IServiceProvider services, CancellationToken ct)
    {
        var notifications = services.GetRequiredService<INotificationDispatcher>();
        return notifications.NotifyLandlordInviteRejectedAsync(
            evt.LandlordId,
            new InviteRejectedNotification(evt.InviteId),
            ct);
    }
}
