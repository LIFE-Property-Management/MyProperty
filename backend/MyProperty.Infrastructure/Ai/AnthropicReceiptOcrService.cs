using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Ocr;

namespace MyProperty.Infrastructure.Ai;

public sealed partial class AnthropicReceiptOcrService(
    HttpClient httpClient,
    IOptions<AnthropicOcrOptions> options,
    ILogger<AnthropicReceiptOcrService> logger) : IReceiptOcrService
{
    private static int _warnedAboutMissingKey;

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public async Task<ReceiptOcrResult> ExtractAsync(
        Stream image,
        string contentType,
        CancellationToken ct)
    {
        var opts = options.Value;

        if (string.IsNullOrEmpty(opts.ApiKey))
        {
            if (Interlocked.CompareExchange(ref _warnedAboutMissingKey, 1, 0) == 0)
                logger.LogWarning("Anthropic:ApiKey is not configured. Receipt OCR is disabled (stub mode).");
            return new ReceiptOcrResult(null, null, null, "OCR_DISABLED_NO_API_KEY");
        }

        try
        {
            using var ms = new MemoryStream();
            await image.CopyToAsync(ms, ct);
            var base64 = Convert.ToBase64String(ms.ToArray());

            var requestBody = new
            {
                model = opts.Model,
                max_tokens = 512,
                messages = new[]
                {
                    new
                    {
                        role = "user",
                        content = new object[]
                        {
                            new
                            {
                                type = "image",
                                source = new
                                {
                                    type = "base64",
                                    media_type = contentType,
                                    data = base64,
                                },
                            },
                            new
                            {
                                type = "text",
                                text = "Extract the total amount, payment date, and merchant name from this receipt. Respond with ONLY a JSON object on a single line, no prose, no markdown fences. Schema: {\"amount\": number|null, \"date\": \"YYYY-MM-DD\"|null, \"merchant\": string|null}. Use null for any field you cannot determine confidently.",
                            },
                        },
                    },
                },
            };

            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages");
            request.Headers.Add("x-api-key", opts.ApiKey);
            request.Headers.Add("anthropic-version", "2023-06-01");
            request.Content = JsonContent.Create(requestBody);

            using var response = await httpClient.SendAsync(request, ct);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("OCR HTTP error: {StatusCode}", (int)response.StatusCode);
                return new ReceiptOcrResult(null, null, null, $"OCR_HTTP_ERROR_{(int)response.StatusCode}");
            }

            var rawBody = await response.Content.ReadAsStringAsync(ct);

            string rawText;
            try
            {
                using var doc = JsonDocument.Parse(rawBody);
                rawText = doc.RootElement
                    .GetProperty("content")[0]
                    .GetProperty("text")
                    .GetString() ?? "";
            }
            catch (Exception ex) when (ex is JsonException or KeyNotFoundException or IndexOutOfRangeException or InvalidOperationException)
            {
                logger.LogWarning("OCR: unexpected Anthropic response shape. Raw: {Raw}",
                    rawBody[..Math.Min(500, rawBody.Length)]);
                return new ReceiptOcrResult(null, null, null,
                    $"OCR_PARSE_ERROR: {rawBody[..Math.Min(500, rawBody.Length)]}");
            }

            rawText = CodeFenceRegex().Replace(rawText, "").Trim();

            OcrJsonResponse? parsed;
            try
            {
                parsed = JsonSerializer.Deserialize<OcrJsonResponse>(rawText, _jsonOptions);
            }
            catch (JsonException)
            {
                logger.LogWarning("OCR JSON parse failure. Raw text: {Raw}",
                    rawText[..Math.Min(500, rawText.Length)]);
                return new ReceiptOcrResult(null, null, null,
                    $"OCR_PARSE_ERROR: {rawText[..Math.Min(500, rawText.Length)]}");
            }

            if (parsed is null)
                return new ReceiptOcrResult(null, null, null,
                    $"OCR_PARSE_ERROR: {rawText[..Math.Min(500, rawText.Length)]}");

            DateOnly? parsedDate = null;
            if (parsed.Date is not null &&
                DateOnly.TryParseExact(parsed.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture,
                    DateTimeStyles.None, out var d))
            {
                parsedDate = d;
            }

            return new ReceiptOcrResult(parsed.Amount, parsedDate, parsed.Merchant, rawText);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning(ex, "OCR network error");
            return new ReceiptOcrResult(null, null, null, "OCR_NETWORK_ERROR");
        }
        catch (TaskCanceledException ex) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning(ex, "OCR request timed out");
            return new ReceiptOcrResult(null, null, null, "OCR_NETWORK_ERROR");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "OCR unexpected error");
            return new ReceiptOcrResult(null, null, null, "OCR_NETWORK_ERROR");
        }
    }

    [GeneratedRegex(@"^```(?:json)?\s*|\s*```$", RegexOptions.Multiline)]
    private static partial Regex CodeFenceRegex();

    private sealed record OcrJsonResponse(decimal? Amount, string? Date, string? Merchant);
}
