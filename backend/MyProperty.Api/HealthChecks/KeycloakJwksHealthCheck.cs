using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using MyProperty.Api.Options;

namespace MyProperty.Api.HealthChecks;

/// <summary>
/// Diagnostic check only — does not block /ready. The JWKS is aggressively cached by the JWT
/// middleware; transient Keycloak unavailability does not impact validation of already-issued tokens.
/// </summary>
internal sealed class KeycloakJwksHealthCheck(
    IHttpClientFactory httpClientFactory,
    IOptions<KeycloakOptions> keycloakOptions) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var authority = keycloakOptions.Value.Authority.TrimEnd('/');
            var jwksUrl = $"{authority}/protocol/openid-connect/certs";

            using var client = httpClientFactory.CreateClient("keycloak-jwks");
            using var response = await client.GetAsync(jwksUrl, cancellationToken);

            return response.IsSuccessStatusCode
                ? HealthCheckResult.Healthy("JWKS endpoint reachable")
                : HealthCheckResult.Unhealthy($"JWKS endpoint returned {(int)response.StatusCode}");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("JWKS endpoint unreachable", ex);
        }
    }
}
