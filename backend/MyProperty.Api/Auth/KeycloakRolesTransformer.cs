using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;

namespace MyProperty.Api.Auth;

/// <summary>
/// Projects Keycloak realm roles from the JWT's <c>realm_access.roles</c> JSON
/// object onto standard ASP.NET Core <see cref="ClaimTypes.Role"/> claims so that
/// <c>[Authorize(Roles = "...")]</c> and <c>RequireRole(...)</c> policies work.
/// </summary>
/// <remarks>
/// This cannot be replaced by setting <c>TokenValidationParameters.RoleClaimType</c>
/// because Keycloak emits roles as a nested JSON object (<c>realm_access.roles[]</c>),
/// not a flat string claim. The JWT middleware can only map a single claim name
/// to <see cref="ClaimTypes.Role"/>; it cannot extract array elements from a
/// nested JSON value. This transformer does that extraction.
///
/// Registered as Transient per Microsoft's recommendation for
/// <see cref="IClaimsTransformation"/> implementations.
/// </remarks>
public sealed class KeycloakRolesTransformer : IClaimsTransformation
{
    public Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        if (principal.Identity is not ClaimsIdentity identity || !identity.IsAuthenticated)
            return Task.FromResult(principal);

        // Idempotency guard: if any ClaimTypes.Role claim is already present,
        // assume a previous transformation pass already projected realm roles
        // and skip re-parsing. Cheap defense against duplicate enumeration.
        if (identity.HasClaim(c => c.Type == ClaimTypes.Role))
            return Task.FromResult(principal);

        var realmAccess = identity.FindFirst("realm_access")?.Value;
        if (realmAccess is null)
            return Task.FromResult(principal);

        using var doc = JsonDocument.Parse(realmAccess);
        if (!doc.RootElement.TryGetProperty("roles", out var roles)
            || roles.ValueKind != JsonValueKind.Array)
            return Task.FromResult(principal);

        foreach (var role in roles.EnumerateArray())
        {
            var value = role.GetString();
            if (!string.IsNullOrWhiteSpace(value))
                identity.AddClaim(new Claim(ClaimTypes.Role, value));
        }

        return Task.FromResult(principal);
    }
}
