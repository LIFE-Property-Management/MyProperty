using System.ComponentModel.DataAnnotations;

namespace MyProperty.Infrastructure.Keycloak;

public sealed class KeycloakAdminOptions
{
    public const string SectionName = "KeycloakAdmin";

    [Required]
    public string BaseUrl { get; init; } = string.Empty;

    [Required]
    public string Realm { get; init; } = string.Empty;

    [Required]
    public string ClientId { get; init; } = string.Empty;

    [Required]
    public string ClientSecret { get; init; } = string.Empty;
}
