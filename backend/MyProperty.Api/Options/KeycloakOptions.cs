using System.ComponentModel.DataAnnotations;

namespace MyProperty.Api.Options;

public sealed class KeycloakOptions
{
    public const string SectionName = "Keycloak";

    [Required]
    public string Authority { get; init; } = string.Empty;
}
