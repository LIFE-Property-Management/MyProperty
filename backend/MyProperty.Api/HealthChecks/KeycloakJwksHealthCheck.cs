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
            // Prefer the cluster-internal MetadataAddress when set — Authority
            // is the browser-facing URL (used as ValidIssuer) and isn't
            // necessarily reachable from inside the API pod. The discovery URL
            // ends with /.well-known/openid-configuration; strip that to get
            // the realm base, then append the JWKS path. Falls back to
            // {Authority}/protocol/openid-connect/certs when MetadataAddress
            // isn't configured (single-network deployments).
            var options = keycloakOptions.Value;
            string realmBase;
            if (!string.IsNullOrWhiteSpace(options.MetadataAddress))
            {
                const string WellKnownSuffix = "/.well-known/openid-configuration";
                var addr = options.MetadataAddress;
                realmBase = addr.EndsWith(WellKnownSuffix, StringComparison.Ordinal)
                    ? addr[..^WellKnownSuffix.Length]
                    : addr.TrimEnd('/');
            }
            else
            {
                realmBase = options.Authority.TrimEnd('/');
            }

            var jwksUrl = $"{realmBase}/protocol/openid-connect/certs";

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
