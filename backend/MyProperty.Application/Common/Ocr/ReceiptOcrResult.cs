namespace MyProperty.Application.Common.Ocr;

public sealed record ReceiptOcrResult(
    decimal? Amount,
    DateOnly? Date,
    string? Merchant,
    string RawResponse);
