namespace MyProperty.Infrastructure.Keycloak;

/// <summary>
/// Supplies a (cached) client-credentials access token for the Keycloak Admin REST API.
/// Implemented by <see cref="KeycloakAdminTokenCache"/>; abstracted so the admin client
/// can be unit-tested without exercising the live token endpoint.
/// </summary>
internal interface IKeycloakAdminTokenCache
{
    Task<string> GetTokenAsync(CancellationToken ct);
}
