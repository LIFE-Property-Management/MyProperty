using System.ComponentModel.DataAnnotations;

namespace MyProperty.Api.Options;

public sealed class KeycloakOptions
{
    public const string SectionName = "Keycloak";

    [Required]
    public string Authority { get; init; } = string.Empty;

    // Optional override for the OIDC metadata document URL. When set, JWKS
    // discovery uses this URL instead of `{Authority}/.well-known/openid-configuration`.
    // Required for split-network deployments where the issuer URL (browser-facing,
    // baked into JWT `iss` claims) differs from the cluster-internal URL the API
    // pod uses to reach Keycloak — the canonical example is the local docker
    // compose stack, where the browser hits http://localhost:8080 but the API
    // container reaches Keycloak at http://keycloak:8080. Authority stays the
    // public URL (used as the default ValidIssuer); MetadataAddress points at
    // the reachable JWKS endpoint. See infrastructure/keycloak/PRODUCTION.md.
    public string? MetadataAddress { get; init; }
}
