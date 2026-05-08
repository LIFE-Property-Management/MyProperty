using MyProperty.Application.Common.Ocr;

namespace MyProperty.Application.Common.Interfaces;

public interface IReceiptOcrService
{
    Task<ReceiptOcrResult> ExtractAsync(
        Stream image,
        string contentType,
        CancellationToken ct);
}
