using System.Text.Json;
using Hangfire;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MyProperty.Application.Payments.Events;
using MyProperty.Infrastructure.Jobs;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace MyProperty.Infrastructure.Messaging.Consumers;

public sealed class PaymentSubmittedConsumer : BackgroundService
{
    private const string ExchangeName = "myproperty";
    private const string QueueName    = "myproperty.payment.submitted";
    private const string RoutingKey   = "payment.submitted";

    private readonly IConnectionFactory _factory;
    private readonly IBackgroundJobClient _jobClient;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PaymentSubmittedConsumer> _logger;

    public PaymentSubmittedConsumer(
        IConnectionFactory factory,
        IBackgroundJobClient jobClient,
        IServiceScopeFactory scopeFactory,
        ILogger<PaymentSubmittedConsumer> logger)
    {
        _factory    = factory;
        _jobClient  = jobClient;
        _scopeFactory = scopeFactory;
        _logger     = logger;
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
                var evt = JsonSerializer.Deserialize<PaymentSubmittedEvent>(ea.Body.Span);
                if (evt is null)
                {
                    _logger.LogWarning("Failed to deserialize PaymentSubmittedEvent — discarding");
                    await channel.BasicNackAsync(ea.DeliveryTag, multiple: false, requeue: false);
                    return;
                }

                _jobClient.Enqueue<OcrStubJob>(job => job.ExecuteAsync(evt.PaymentId, CancellationToken.None));
                _logger.LogInformation("Enqueued OCR stub for PaymentId {PaymentId}", evt.PaymentId);

                await channel.BasicAckAsync(ea.DeliveryTag, multiple: false);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing payment.submitted message");
                await channel.BasicNackAsync(ea.DeliveryTag, multiple: false, requeue: false);
            }
        };

        await channel.BasicConsumeAsync(QueueName, autoAck: false, consumer: consumer, cancellationToken: stoppingToken);

        try { await Task.Delay(Timeout.Infinite, stoppingToken); }
        catch (OperationCanceledException) { }
    }
}
