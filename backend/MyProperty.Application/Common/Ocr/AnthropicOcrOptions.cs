using System.ComponentModel.DataAnnotations;

namespace MyProperty.Application.Common.Ocr;

public sealed class AnthropicOcrOptions
{
    public const string SectionName = "Anthropic";

    /// <summary>
    /// When null/empty, OCR runs in stub mode — the service returns an
    /// all-null result and logs a warning once.
    /// </summary>
    public string? ApiKey { get; set; }

    [Required]
    public string Model { get; set; } = "claude-sonnet-4-5-20250929";

    [Range(1, 30)]
    public int TimeoutSeconds { get; set; } = 30;
}
