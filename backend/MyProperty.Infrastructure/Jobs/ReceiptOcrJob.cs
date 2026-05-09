using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Infrastructure.Persistence;

namespace MyProperty.Infrastructure.Jobs;

public sealed class ReceiptOcrJob(
    AppDbContext db,
    IFileStorage fileStorage,
    IReceiptOcrService ocr,
    ILogger<ReceiptOcrJob> logger)
{
    public async Task ExecuteAsync(Guid paymentId, CancellationToken ct)
    {
        var payment = await db.Payments
            .FirstOrDefaultAsync(p => p.Id == paymentId, ct);

        if (payment is null)
        {
            logger.LogWarning("OCR job: payment {PaymentId} not found", paymentId);
            return;
        }

        if (payment.ReceiptFileKey is null)
        {
            logger.LogInformation(
                "OCR job: payment {PaymentId} has no receipt, skipping", paymentId);
            return;
        }

        if (payment.OcrProcessedAt is not null)
        {
            logger.LogInformation(
                "OCR job: payment {PaymentId} already processed at {ProcessedAt}, skipping",
                paymentId, payment.OcrProcessedAt);
            return;
        }

        await using var stream = await fileStorage.DownloadAsync(payment.ReceiptFileKey, ct);
        var contentType = payment.ReceiptContentType ?? "application/octet-stream";

        var result = await ocr.ExtractAsync(stream, contentType, ct);

        payment.OcrAmount = result.Amount;
        payment.OcrDate = result.Date;
        payment.OcrMerchant = result.Merchant;
        payment.OcrRawResponse = result.RawResponse;
        payment.OcrProcessedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "OCR job: payment {PaymentId} processed (amount={Amount}, date={Date}, merchant={Merchant})",
            paymentId, result.Amount, result.Date, result.Merchant);
    }
}
