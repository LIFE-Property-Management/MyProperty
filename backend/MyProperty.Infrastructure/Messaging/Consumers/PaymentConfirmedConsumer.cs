using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyProperty.Application.Common.Email;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Payments.Events;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using RabbitMQ.Client.Exceptions;

namespace MyProperty.Infrastructure.Messaging.Consumers;

/// <summary>
/// Consumes <see cref="PaymentConfirmedEvent"/> messages off RabbitMQ and
/// translates each one into a Hangfire <c>SendEmailJob</c> that delivers a
/// confirmation receipt to the tenant. This is the M3.8 "worked example" wiring
/// from <c>backend/CLAUDE.md</c> — the consumer carries no business logic; the
/// state change has already been persisted by <c>ConfirmPaymentHandler</c>.
/// </summary>
/// <remarks>
/// <para>
/// <b>Topology.</b> Durable topic exchange <c>myproperty.events</c>; a single
/// durable queue <c>myproperty.payment.confirmed.email</c> bound with routing
/// key <c>payment.confirmed</c>. Manual acknowledgements: the message is acked
/// once the email job is safely enqueued in Hangfire's Postgres store, so a
/// crash mid-handle redelivers the event rather than losing the notification.
/// </para>
/// <para>
/// <b>Connect retry.</b> If RabbitMQ is unreachable at startup, <c>ExecuteAsync</c>
/// retries with linear backoff. The RabbitMQ.Client v7 connection itself enables
/// automatic recovery, so transient blips after the initial connect are handled
/// inside the library.
/// </para>
/// <para>
/// <b>Poison messages.</b> A payload that fails to deserialize is rejected
/// without requeue and logged at error level. The current topology has no DLX,
/// so the message is dropped — acceptable for MVP because the source of truth
/// (the <c>payments</c> row) is unaffected.
/// </para>
/// </remarks>
public sealed class PaymentConfirmedConsumer(
    RabbitMqConnectionProvider connections,
    IServiceScopeFactory scopeFactory,
    IOptions<RabbitMqOptions> options,
    ILogger<PaymentConfirmedConsumer> logger) : BackgroundService
{
    private const string QueueName = "myproperty.payment.confirmed.email";
    private const string RoutingKey = "payment.confirmed";

    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);
    private static readonly TimeSpan ConnectRetryDelay = TimeSpan.FromSeconds(5);

    private readonly RabbitMqOptions _options = options.Value;
    private IChannel? _channel;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await StartConsumingAsync(stoppingToken);
                // StartConsumingAsync returns once the consumer is wired; the
                // remainder of the lifetime is just waiting for cancellation
                // while RabbitMQ pushes deliveries to ReceivedAsync.
                await Task.Delay(Timeout.Infinite, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (BrokerUnreachableException ex)
            {
                logger.LogWarning(
                    ex,
                    "RabbitMQ unreachable; retrying in {Delay}s.",
                    ConnectRetryDelay.TotalSeconds);
                await SafelyDelayAsync(ConnectRetryDelay, stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "PaymentConfirmedConsumer crashed; restarting after {Delay}s.",
                    ConnectRetryDelay.TotalSeconds);
                await SafelyDelayAsync(ConnectRetryDelay, stoppingToken);
            }
        }
    }

    private async Task StartConsumingAsync(CancellationToken ct)
    {
        
        if (_channel is not null)
        {
            try { await _channel.CloseAsync(ct); } catch { }
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

        // Process one message at a time so a slow handler does not stockpile
        // unacked deliveries; the email enqueue is fast (Postgres insert) so
        // throughput is not a concern for this consumer.
        await _channel.BasicQosAsync(prefetchSize: 0, prefetchCount: 1, global: false, cancellationToken: ct);

        var consumer = new AsyncEventingBasicConsumer(_channel);
        consumer.ReceivedAsync += OnMessageAsync;

        await _channel.BasicConsumeAsync(
            queue:    QueueName,
            autoAck:  false,
            consumer: consumer,
            cancellationToken: ct);

        logger.LogInformation(
            "PaymentConfirmedConsumer ready — bound {Queue} to {Exchange}/{RoutingKey}.",
            QueueName, _options.Exchange, RoutingKey);
    }

    private async Task OnMessageAsync(object sender, BasicDeliverEventArgs ea)
    {
        var channel = _channel
            ?? throw new InvalidOperationException("Channel not initialised before delivery.");

        PaymentConfirmedEvent? evt;
        try
        {
            evt = JsonSerializer.Deserialize<PaymentConfirmedEvent>(ea.Body.Span, SerializerOptions);
        }
        catch (JsonException ex)
        {
            logger.LogError(ex,
                "Discarding malformed PaymentConfirmedEvent (delivery {DeliveryTag}, message {MessageId}).",
                ea.DeliveryTag, ea.BasicProperties.MessageId);
            await channel.BasicRejectAsync(ea.DeliveryTag, requeue: false);
            return;
        }

        if (evt is null)
        {
            logger.LogError(
                "Discarding null PaymentConfirmedEvent payload (delivery {DeliveryTag}).",
                ea.DeliveryTag);
            await channel.BasicRejectAsync(ea.DeliveryTag, requeue: false);
            return;
        }

        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var users = scope.ServiceProvider.GetRequiredService<IUserRepository>();
            var jobs  = scope.ServiceProvider.GetRequiredService<IBackgroundJobQueue>();

            var tenant = await users.GetByIdAsync(evt.TenantId, CancellationToken.None);
            if (tenant is null)
            {
                logger.LogWarning(
                    "PaymentConfirmedEvent references unknown tenant {TenantId}; acking anyway.",
                    evt.TenantId);
                await channel.BasicAckAsync(ea.DeliveryTag, multiple: false);
                return;
            }

            var email = BuildConfirmationEmail(tenant.Email, tenant.FirstName, evt);
            jobs.EnqueueEmail(email);

            logger.LogInformation(
                "Enqueued confirmation email for payment {PaymentId} → {Email}.",
                evt.PaymentId, tenant.Email);

            await channel.BasicAckAsync(ea.DeliveryTag, multiple: false);
        }
        catch (Exception ex)
        {
            // Transient failure (DB down, scope build failure, etc.). Requeue
            // so RabbitMQ redelivers once the dependency recovers.
            logger.LogError(ex,
                "Failed to handle PaymentConfirmedEvent for payment {PaymentId}; requeueing.",
                evt.PaymentId);
            await channel.BasicNackAsync(ea.DeliveryTag, multiple: false, requeue: true);
        }
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
