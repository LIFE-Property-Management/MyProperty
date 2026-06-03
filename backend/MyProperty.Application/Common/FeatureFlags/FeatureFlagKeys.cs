namespace MyProperty.Application.Common.FeatureFlags;

/// <summary>
/// Canonical feature-flag keys. Centralised so call sites and the Unleash
/// dashboard share one spelling (avoids the magic-string drift the backend
/// CLAUDE.md flags for the dashboard cache key).
/// </summary>
public static class FeatureFlagKeys
{
    /// <summary>
    /// Kill-switch for the receipt-OCR auto-extraction pipeline. When OFF, a
    /// submitted receipt is NOT sent to the Anthropic vision API; the payment
    /// keeps its null OCR fields (manual-entry fallback, identical to the
    /// no-receipt path). Defaults to ON if Unleash is unreachable.
    /// </summary>
    public const string OcrAutoExtract = "payments.ocr-autoextract";
}
