using Microsoft.Extensions.Logging;

namespace MyProperty.Infrastructure.Jobs;

// Placeholder for M3.10 — replaced with real OCR logic once receipt upload lands.
public sealed class OcrStubJob(ILogger<OcrStubJob> logger)
{
    public Task ExecuteAsync(Guid paymentId, CancellationToken cancellationToken)
    {
        logger.LogInformation("OCR stub — PaymentId {PaymentId} — M3.10 pending", paymentId);
        return Task.CompletedTask;
    }
}
