using System.ComponentModel.DataAnnotations;

namespace MyProperty.Application.Common.Options;

/// <summary>
/// Configuration for the self-hosted Unleash feature-flag server, bound from
/// the <c>Unleash</c> section. Mirrors the <see cref="CacheOptions"/> shape.
/// </summary>
public sealed class UnleashOptions
{
    public const string SectionName = "Unleash";

    /// <summary>
    /// Unleash client API base URL, including the trailing <c>/api/</c>.
    /// Example dev value: <c>http://localhost:4242/api/</c>. Required.
    /// </summary>
    [Required]
    public required string ApiUrl { get; set; }

    /// <summary>
    /// Client API token (<c>&lt;project&gt;:&lt;environment&gt;.&lt;secret&gt;</c>).
    /// Null/empty disables the live client: the app registers a no-op provider
    /// and every <c>IsEnabledAsync</c> call returns the caller-supplied default.
    /// Supplied via env var / secret in deployed environments.
    /// </summary>
    public string? ApiToken { get; set; }

    /// <summary>Application name reported to Unleash (groups SDK metrics).</summary>
    public string AppName { get; set; } = "myproperty-api";

    /// <summary>How often the SDK refreshes its in-memory toggle snapshot.</summary>
    [Range(1, 300)]
    public int FetchTogglesIntervalSeconds { get; set; } = 15;
}
