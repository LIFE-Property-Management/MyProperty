using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyProperty.Application.Common.Messaging;
using RabbitMQ.Client;

namespace MyProperty.Infrastructure.Messaging;

/// <summary>
/// <see cref="IEventPublisher"/> backed by RabbitMQ.Client v7 async API.
/// Publishes onto a topic exchange (declared once per channel) using a routing
/// key derived from the event type name.
/// </summary>
/// <remarks>
/// Channels in v7 are not thread-safe and are cheap to create, so this
/// publisher opens a fresh channel per <see cref="PublishAsync"/> call. The
/// underlying connection is shared via <see cref="RabbitMqConnectionProvider"/>.
/// </remarks>
public sealed class RabbitMqEventPublisher(
    RabbitMqConnectionProvider connections,
    IOptions<RabbitMqOptions> options,
    ILogger<RabbitMqEventPublisher> logger) : IEventPublisher
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);
    private readonly RabbitMqOptions _options = options.Value;

    public async Task PublishAsync<T>(T @event, CancellationToken ct) where T : class, IIntegrationEvent
    {
        ArgumentNullException.ThrowIfNull(@event);

        var routingKey = IntegrationEventNaming.RoutingKey(typeof(T));
        var body = JsonSerializer.SerializeToUtf8Bytes(@event, SerializerOptions);

        try
        {
            var connection = await connections.GetConnectionAsync(ct);
            await using var channel = await connection.CreateChannelAsync(cancellationToken: ct);

            await channel.ExchangeDeclareAsync(
                exchange: _options.Exchange,
                type:     ExchangeType.Topic,
                durable:  true,
                autoDelete: false,
                cancellationToken: ct);

            var properties = new BasicProperties
            {
                ContentType  = "application/json",
                DeliveryMode = DeliveryModes.Persistent,
                Type         = typeof(T).Name,
                MessageId    = Guid.NewGuid().ToString("N"),
                Timestamp    = new AmqpTimestamp(DateTimeOffset.UtcNow.ToUnixTimeSeconds()),
            };

            await channel.BasicPublishAsync(
                exchange:    _options.Exchange,
                routingKey:  routingKey,
                mandatory:   false,
                basicProperties: properties,
                body:        body,
                cancellationToken: ct);

            logger.LogInformation(
                "Published {EventType} to {Exchange} with routing key {RoutingKey}",
                typeof(T).Name, _options.Exchange, routingKey);
        }
        catch (Exception ex)
        {
            // Events are side-effect signals, not the source of truth. The DB
            // commit has already succeeded by the time we get here; failing the
            // request because RabbitMQ blinked would punish the user for an
            // operational problem. Log + continue. The miss surfaces as a
            // missed downstream notification, not a missed state change.
            logger.LogError(
                ex,
                "Failed to publish {EventType} with routing key {RoutingKey} to RabbitMQ. " +
                "DB state is unchanged but downstream consumers will not see this event.",
                typeof(T).Name, routingKey);
        }
    }
}
