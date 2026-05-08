using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyProperty.Application.Common.Messaging;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using RabbitMQ.Client.Exceptions;

namespace MyProperty.Infrastructure.Messaging.Consumers;

/// <summary>
/// Boilerplate for a single-event RabbitMQ consumer hosted service. Subclasses
/// declare the queue name + routing key and implement the side-effect work in
/// <see cref="HandleAsync"/>; this base owns the connection lifecycle, topology
/// declaration, and ack/nack semantics.
/// </summary>
/// <remarks>
/// <para>
/// <b>Topology.</b> Each subclass binds its own durable queue to the shared
/// <c>myproperty.events</c> topic exchange with a single routing key, so adding
/// a new consumer is purely additive: it creates its own queue and reads
/// messages without affecting any existing subscriber.
/// </para>
/// <para>
/// <b>Ack semantics.</b> If <see cref="HandleAsync"/> returns normally the
/// message is acked. If it throws, the message is nacked with requeue, so a
/// transient failure (DB blip, scope build error) gets redelivered. JSON
/// deserialization failures are treated as poison messages and rejected
/// without requeue. There is no DLX — the source of truth is the DB row, so a
/// dropped notification does not lose state.
/// </para>
/// </remarks>
public abstract class IntegrationEventConsumerBase<TEvent>(
    RabbitMqConnectionProvider connections,
    IServiceScopeFactory scopeFactory,
    IOptions<RabbitMqOptions> options,
    ILogger logger) : BackgroundService
    where TEvent : class, IIntegrationEvent
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);
    private static readonly TimeSpan ConnectRetryDelay = TimeSpan.FromSeconds(5);

    private readonly RabbitMqOptions _options = options.Value;
    private IChannel? _channel;

    /// <summary>Durable queue this consumer subscribes to.</summary>
    protected abstract string QueueName { get; }

    /// <summary>Routing key bound to <see cref="QueueName"/>.</summary>
    protected abstract string RoutingKey { get; }

    /// <summary>
    /// Side effect to run for each delivered message. Resolve scoped services
    /// from <paramref name="services"/>; do not capture them in the consumer
    /// instance (the consumer is a singleton hosted service).
    /// </summary>
    protected abstract Task HandleAsync(TEvent evt, IServiceProvider services, CancellationToken ct);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await StartConsumingAsync(stoppingToken);
                await Task.Delay(Timeout.Infinite, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (BrokerUnreachableException ex)
            {
                logger.LogWarning(
                    ex, "RabbitMQ unreachable for {Consumer}; retrying in {Delay}s.",
                    GetType().Name, ConnectRetryDelay.TotalSeconds);
                await SafelyDelayAsync(ConnectRetryDelay, stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(
                    ex, "{Consumer} crashed; restarting after {Delay}s.",
                    GetType().Name, ConnectRetryDelay.TotalSeconds);
                await SafelyDelayAsync(ConnectRetryDelay, stoppingToken);
            }
        }
    }

    private async Task StartConsumingAsync(CancellationToken ct)
    {
        // If we're restarting after a crash, dispose the previous channel
        // before opening a new one — the connection itself is still cached
        // by the provider.
        if (_channel is not null)
        {
            try { await _channel.CloseAsync(ct); } catch { /* shutdown best effort */ }
            await _channel.DisposeAsync();
            _channel = null;
        }

        var connection = await connections.GetConnectionAsync(ct);
        _channel = await connection.CreateChannelAsync(cancellationToken: ct);

        await _channel.ExchangeDeclareAsync(
            exchange:   _options.Exchange,
            type:       ExchangeType.Topic,
            durable:    true,
            autoDelete: false,
            cancellationToken: ct);

        await _channel.QueueDeclareAsync(
            queue:      QueueName,
            durable:    true,
            exclusive:  false,
            autoDelete: false,
            cancellationToken: ct);

        await _channel.QueueBindAsync(
            queue:      QueueName,
            exchange:   _options.Exchange,
            routingKey: RoutingKey,
            cancellationToken: ct);

        // One message at a time — the side-effect work is tiny (in-process
        // SignalR push or Hangfire enqueue) so concurrency isn't worth the
        // unacked-pile-up risk.
        await _channel.BasicQosAsync(prefetchSize: 0, prefetchCount: 1, global: false, cancellationToken: ct);

        var consumer = new AsyncEventingBasicConsumer(_channel);
        consumer.ReceivedAsync += OnMessageAsync;

        await _channel.BasicConsumeAsync(
            queue:    QueueName,
            autoAck:  false,
            consumer: consumer,
            cancellationToken: ct);

        logger.LogInformation(
            "{Consumer} ready — bound {Queue} to {Exchange}/{RoutingKey}.",
            GetType().Name, QueueName, _options.Exchange, RoutingKey);
    }

    private async Task OnMessageAsync(object sender, BasicDeliverEventArgs ea)
    {
        var channel = _channel
            ?? throw new InvalidOperationException("Channel not initialised before delivery.");

        TEvent? evt;
        try
        {
            evt = JsonSerializer.Deserialize<TEvent>(ea.Body.Span, SerializerOptions);
        }
        catch (JsonException ex)
        {
            logger.LogError(ex,
                "Discarding malformed {EventType} (delivery {DeliveryTag}, message {MessageId}).",
                typeof(TEvent).Name, ea.DeliveryTag, ea.BasicProperties.MessageId);
            await channel.BasicRejectAsync(ea.DeliveryTag, requeue: false);
            return;
        }

        if (evt is null)
        {
            logger.LogError(
                "Discarding null {EventType} payload (delivery {DeliveryTag}).",
                typeof(TEvent).Name, ea.DeliveryTag);
            await channel.BasicRejectAsync(ea.DeliveryTag, requeue: false);
            return;
        }

        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            await HandleAsync(evt, scope.ServiceProvider, CancellationToken.None);
            await channel.BasicAckAsync(ea.DeliveryTag, multiple: false);
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "Failed to handle {EventType} (delivery {DeliveryTag}); requeueing.",
                typeof(TEvent).Name, ea.DeliveryTag);
            await channel.BasicNackAsync(ea.DeliveryTag, multiple: false, requeue: true);
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        await base.StopAsync(cancellationToken);
        if (_channel is not null)
        {
            try { await _channel.CloseAsync(cancellationToken); }
            catch { /* shutdown best effort */ }
            await _channel.DisposeAsync();
            _channel = null;
        }
    }

    private static async Task SafelyDelayAsync(TimeSpan delay, CancellationToken ct)
    {
        try { await Task.Delay(delay, ct); }
        catch (OperationCanceledException) { /* host stopping */ }
    }
}
