using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyProperty.Application.Common.FeatureFlags;
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
/// <remarks>
/// Not <c>sealed</c> so <c>PaymentSubmittedOcrConsumerTests</c> can subclass it
/// to exercise <see cref="HandleAsync"/> directly (the M5.6 OCR feature-flag gate).
/// </remarks>
public class PaymentSubmittedOcrConsumer(
    RabbitMqConnectionProvider connections,
    IServiceScopeFactory scopeFactory,
    IOptions<RabbitMqOptions> options,
    ILogger<PaymentSubmittedOcrConsumer> logger)
    : IntegrationEventConsumerBase<PaymentSubmittedEvent>(connections, scopeFactory, options, logger)
{
    protected override string QueueName => "myproperty.payment.submitted.ocr";
    protected override string RoutingKey => "payment.submitted";

    protected override async Task HandleAsync(
        PaymentSubmittedEvent evt, IServiceProvider services, CancellationToken ct)
    {
        if (evt.ReceiptFileKey is null)
            return;

        // M5.6 kill-switch: when payments.ocr-autoextract is OFF, skip the OCR
        // job entirely. The payment keeps its null OCR fields — the same
        // manual-entry state as a no-receipt submission — so nothing downstream
        // breaks. Defaults ON so a missing/unreachable Unleash never disables a
        // shipped feature (see the IFeatureFlags contract).
        var flags = services.GetRequiredService<IFeatureFlags>();
        if (!await flags.IsEnabledAsync(FeatureFlagKeys.OcrAutoExtract, defaultValue: true, ct))
        {
            logger.LogInformation(
                "OCR auto-extract disabled by feature flag; payment {PaymentId} stays manual-entry.",
                evt.PaymentId);
            return;
        }

        var queue = services.GetRequiredService<IBackgroundJobQueue>();
        queue.EnqueueReceiptOcr(evt.PaymentId);
    }
}
