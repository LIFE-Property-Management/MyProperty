using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Payments.Events;

namespace MyProperty.Infrastructure.Messaging.Consumers;

/// <summary>
/// Consumes <see cref="PaymentSubmittedEvent"/> and enqueues a Hangfire job
/// to run receipt OCR. Sibling to <see cref="PaymentSubmittedConsumer"/> —
/// each consumer has its own queue bound to the same routing key, so
/// RabbitMQ fans the event out to both. Skips events whose
/// <c>ReceiptFileKey</c> is null (manual cash submissions).
/// </summary>
public sealed class PaymentSubmittedOcrConsumer(
    RabbitMqConnectionProvider connections,
    IServiceScopeFactory scopeFactory,
    IOptions<RabbitMqOptions> options,
    ILogger<PaymentSubmittedOcrConsumer> logger)
    : IntegrationEventConsumerBase<PaymentSubmittedEvent>(connections, scopeFactory, options, logger)
{
    protected override string QueueName  => "myproperty.payment.submitted.ocr";
    protected override string RoutingKey => "payment.submitted";

    protected override Task HandleAsync(
        PaymentSubmittedEvent evt, IServiceProvider services, CancellationToken ct)
    {
        if (evt.ReceiptFileKey is null)
            return Task.CompletedTask;

        var queue = services.GetRequiredService<IBackgroundJobQueue>();
        queue.EnqueueReceiptOcr(evt.PaymentId);
        return Task.CompletedTask;
    }
}
