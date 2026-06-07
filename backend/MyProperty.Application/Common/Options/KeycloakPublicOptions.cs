using System.ComponentModel.DataAnnotations;

namespace MyProperty.Application.Common.Options;

/// <summary>
/// Read-only view of the public Keycloak settings that Application-layer
/// handlers need (e.g. building a login URL in a response DTO).
/// Bound from the same "Keycloak" section as <c>KeycloakOptions</c> in the Api layer.
/// </summary>
public sealed class KeycloakPublicOptions
{
    public const string SectionName = "Keycloak";

    [Required]
    public string Authority { get; init; } = string.Empty;
}
