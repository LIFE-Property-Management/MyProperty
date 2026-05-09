using System.Security.Claims;

namespace MyProperty.Application.Common.Interfaces;

/// <summary>
/// Represents the authenticated principal making the current request.
/// Implementations read identity from the runtime context (HTTP for the API,
/// background-job context for Hangfire jobs, etc.).
/// </summary>
public interface ICurrentUser
{
    /// <summary>
    /// Keycloak subject ID (the JWT <c>sub</c> claim). Null when no user is
    /// authenticated — e.g. for anonymous endpoints or system-initiated work.
    /// Persisted to <c>BaseEntity.CreatedBy</c> / <c>UpdatedBy</c>.
    /// </summary>
    string? KeycloakSubId { get; }

    /// <summary>
    /// Preferred username from the JWT (typically email). Null when unauthenticated.
    /// For display and logging only — never use as a primary key or for authorization.
    /// </summary>
    string? UserName { get; }

    /// <summary>
    /// True when a user is authenticated. False for anonymous requests and for
    /// background-job contexts where no user identity exists.
    /// </summary>
    bool IsAuthenticated { get; }

    /// <summary>
    /// Realm roles from the JWT (<c>realm_access.roles</c>): typically
    /// <c>Tenant</c>, <c>Landlord</c>, or <c>Admin</c>. Empty when unauthenticated.
    /// </summary>
    IReadOnlyCollection<string> Roles { get; }

    /// <summary>True if the current user has the given role.</summary>
    bool IsInRole(string role);

    // TODO post-M3: remove this leak. Handlers need ClaimsPrincipal only because
    // IUserRepository.GetOrSyncFromClaimsAsync takes one. Once Keycloak admin
    // client lands and role assignment moves server-side, sync can run from
    // the user ID alone and this property goes away.
    ClaimsPrincipal? Principal { get; }
}
