using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using MyProperty.Application.Common.FeatureFlags;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Payments.Events;
using MyProperty.Infrastructure.Messaging;
using MyProperty.Infrastructure.Messaging.Consumers;

namespace MyProperty.Tests.Unit.Messaging;

/// <summary>
/// Covers the M5.6 OCR feature-flag gate in <see cref="PaymentSubmittedOcrConsumer"/>:
/// the flag OFF skips the OCR enqueue (manual-entry fallback), ON enqueues exactly
/// once, and a receipt-less (manual) submission never enqueues regardless of the flag.
/// </summary>
public sealed class PaymentSubmittedOcrConsumerTests
{
    // Exposes the protected HandleAsync. HandleAsync never opens a RabbitMQ
    // connection or uses the scope factory, so cheap stand-ins satisfy the base
    // constructor (RabbitMqConnectionProvider only stores options until first use).
    private sealed class TestableOcrConsumer(
        RabbitMqConnectionProvider connections,
        IServiceScopeFactory scopeFactory,
        IOptions<RabbitMqOptions> options,
        ILogger<PaymentSubmittedOcrConsumer> logger)
        : PaymentSubmittedOcrConsumer(connections, scopeFactory, options, logger)
    {
        public Task InvokeAsync(PaymentSubmittedEvent evt, IServiceProvider services, CancellationToken ct)
            => HandleAsync(evt, services, ct);
    }

    private static TestableOcrConsumer BuildConsumer()
    {
        var rabbitOptions = Options.Create(new RabbitMqOptions
        {
            HostName = "unused",
            UserName = "guest",
            Password = "guest",
        });

        return new TestableOcrConsumer(
            new RabbitMqConnectionProvider(rabbitOptions),
            Mock.Of<IServiceScopeFactory>(),
            rabbitOptions,
            NullLogger<PaymentSubmittedOcrConsumer>.Instance);
    }

    private static PaymentSubmittedEvent ReceiptEvent(Guid paymentId) =>
        new(paymentId, Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            100m, "EUR", DateTime.UtcNow, ReceiptFileKey: "receipts/2026/06/receipt.png");

    private static (IServiceProvider Services, Mock<IBackgroundJobQueue> Queue) BuildServices(bool flagEnabled)
    {
        var flags = new Mock<IFeatureFlags>(MockBehavior.Strict);
        flags.Setup(f => f.IsEnabledAsync(FeatureFlagKeys.OcrAutoExtract, true, It.IsAny<CancellationToken>()))
            .ReturnsAsync(flagEnabled);

        var queue = new Mock<IBackgroundJobQueue>(MockBehavior.Strict);
        queue.Setup(q => q.EnqueueReceiptOcr(It.IsAny<Guid>())).Returns("job-1");

        var services = new ServiceCollection();
        services.AddSingleton(flags.Object);
        services.AddSingleton(queue.Object);
        return (services.BuildServiceProvider(), queue);
    }

    [Fact]
    public async Task Flag_off_skips_ocr_enqueue()
    {
        var (services, queue) = BuildServices(flagEnabled: false);

        await BuildConsumer().InvokeAsync(ReceiptEvent(Guid.NewGuid()), services, CancellationToken.None);

        queue.Verify(q => q.EnqueueReceiptOcr(It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task Flag_on_enqueues_ocr_once()
    {
        var paymentId = Guid.NewGuid();
        var (services, queue) = BuildServices(flagEnabled: true);

        await BuildConsumer().InvokeAsync(ReceiptEvent(paymentId), services, CancellationToken.None);

        queue.Verify(q => q.EnqueueReceiptOcr(paymentId), Times.Once);
    }

    [Fact]
    public async Task Manual_submission_without_receipt_skips_ocr_regardless_of_flag()
    {
        var (services, queue) = BuildServices(flagEnabled: true);
        var manualEvent = new PaymentSubmittedEvent(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            50m, "EUR", DateTime.UtcNow, ReceiptFileKey: null);

        await BuildConsumer().InvokeAsync(manualEvent, services, CancellationToken.None);

        queue.Verify(q => q.EnqueueReceiptOcr(It.IsAny<Guid>()), Times.Never);
    }
}
