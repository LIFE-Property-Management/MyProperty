using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MyProperty.Application.Common.Email;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Payments.Events;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace MyProperty.Infrastructure.Messaging.Consumers;

public sealed class PaymentRejectedConsumer : BackgroundService
{
    private const string ExchangeName = "myproperty";
    private const string QueueName    = "myproperty.payment.rejected";
    private const string RoutingKey   = "payment.rejected";

    private readonly IConnectionFactory _factory;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PaymentRejectedConsumer> _logger;

    public PaymentRejectedConsumer(
        IConnectionFactory factory,
        IServiceScopeFactory scopeFactory,
        ILogger<PaymentRejectedConsumer> logger)
    {
        _factory      = factory;
        _scopeFactory = scopeFactory;
        _logger       = logger;
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
                var evt = JsonSerializer.Deserialize<PaymentRejectedEvent>(ea.Body.Span);
                if (evt is null)
                {
                    _logger.LogWarning("Failed to deserialize PaymentRejectedEvent — discarding");
                    await channel.BasicNackAsync(ea.DeliveryTag, multiple: false, requeue: false);
                    return;
                }

                using var scope = _scopeFactory.CreateScope();
                var userRepo    = scope.ServiceProvider.GetRequiredService<IUserRepository>();
                var jobQueue    = scope.ServiceProvider.GetRequiredService<IBackgroundJobQueue>();

                var tenant = await userRepo.GetByIdAsync(evt.TenantId, CancellationToken.None);
                if (tenant is not null)
                {
                    jobQueue.EnqueueEmail(new EmailMessage(
                        To:      tenant.Email,
                        Subject: "Your payment has been rejected",
                        Body:    $"<p>Your payment of {evt.Amount} {evt.Currency} was rejected.</p>" +
                                 $"<p>Reason: {evt.Reason}</p>"));

                    _logger.LogInformation(
                        "Enqueued rejection email for TenantId {TenantId}, PaymentId {PaymentId}",
                        evt.TenantId, evt.PaymentId);
                }
                else
                {
                    _logger.LogWarning("Tenant {TenantId} not found; skipping rejection email", evt.TenantId);
                }

                await channel.BasicAckAsync(ea.DeliveryTag, multiple: false);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing payment.rejected message");
                await channel.BasicNackAsync(ea.DeliveryTag, multiple: false, requeue: false);
            }
        };

        await channel.BasicConsumeAsync(QueueName, autoAck: false, consumer: consumer, cancellationToken: stoppingToken);

        try { await Task.Delay(Timeout.Infinite, stoppingToken); }
        catch (OperationCanceledException) { }
    }
}
