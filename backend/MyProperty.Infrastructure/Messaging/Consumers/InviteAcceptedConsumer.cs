using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MyProperty.Application.Invites.Events;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace MyProperty.Infrastructure.Messaging.Consumers;

// SignalR push to landlord:{LandlordId} deferred to M3.6.
public sealed class InviteAcceptedConsumer : BackgroundService
{
    private const string ExchangeName = "myproperty";
    private const string QueueName    = "myproperty.invite.accepted";
    private const string RoutingKey   = "invite.accepted";

    private readonly IConnectionFactory _factory;
    private readonly ILogger<InviteAcceptedConsumer> _logger;

    public InviteAcceptedConsumer(
        IConnectionFactory factory,
        ILogger<InviteAcceptedConsumer> logger)
    {
        _factory = factory;
        _logger  = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await using var connection = await _factory.CreateConnectionAsync(stoppingToken);
        await using var channel   = await connection.CreateChannelAsync(cancellationToken: stoppingToken);

        await channel.ExchangeDeclareAsync(ExchangeName, ExchangeType.Topic, durable: true, autoDelete: false, cancellationToken: stoppingToken);
        await channel.QueueDeclareAsync(QueueName, durable: true, exclusive: false, autoDelete: false, cancellationToken: stoppingToken);
        await channel.QueueBindAsync(QueueName, ExchangeName, RoutingKey, cancellationToken: stoppingToken);
        await channel.BasicQosAsync(prefetchSize: 0, prefetchCount: 1, global: false, cancellationToken: stoppingToken);

        var consumer = new AsyncEventingBasicConsumer(channel);
        consumer.ReceivedAsync += async (_, ea) =>
        {
            try
            {
                var evt = JsonSerializer.Deserialize<InviteAcceptedEvent>(ea.Body.Span);
                if (evt is null)
                {
                    _logger.LogWarning("Failed to deserialize InviteAcceptedEvent — discarding");
                    await channel.BasicNackAsync(ea.DeliveryTag, multiple: false, requeue: false);
                    return;
                }

                _logger.LogInformation(
                    "InviteAccepted received — InviteId {InviteId}, LandlordId {LandlordId} (SignalR push deferred to M3.6)",
                    evt.InviteId, evt.LandlordId);

                await channel.BasicAckAsync(ea.DeliveryTag, multiple: false);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing invite.accepted message");
                await channel.BasicNackAsync(ea.DeliveryTag, multiple: false, requeue: false);
            }
        };

        await channel.BasicConsumeAsync(QueueName, autoAck: false, consumer: consumer, cancellationToken: stoppingToken);

        try { await Task.Delay(Timeout.Infinite, stoppingToken); }
        catch (OperationCanceledException) { }
    }
}
