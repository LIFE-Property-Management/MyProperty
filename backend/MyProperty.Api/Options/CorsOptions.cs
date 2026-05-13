using System.ComponentModel.DataAnnotations;

namespace MyProperty.Api.Options;

/// <summary>
/// CORS configuration. Allowed origins are the only setting — methods and
/// headers default to "any" because restricting them is more maintenance pain
/// than security benefit; the origin allowlist is the real boundary.
///
/// Origins must be exact <c>scheme://host[:port]</c> without a trailing slash
/// (different from Keycloak <c>redirectUris</c>, which use <c>/*</c>).
/// </summary>
public sealed class CorsOptions
{
    public const string SectionName = "Cors";

    [Required]
    [MinLength(1, ErrorMessage = "At least one allowed origin must be configured.")]
    public string[] AllowedOrigins { get; init; } = [];
}