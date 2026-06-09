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

    /// <summary>Email address from the JWT <c>email</c> claim. Null when unauthenticated.</summary>
    string? Email { get; }

    /// <summary>Given name from the JWT <c>given_name</c> claim. Null when unauthenticated.</summary>
    string? FirstName { get; }

    /// <summary>Family name from the JWT <c>family_name</c> claim. Null when unauthenticated.</summary>
    string? LastName { get; }

    /// <summary>Phone number from the JWT <c>phone_number</c> claim. Null when absent.</summary>
    string? Phone { get; }

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
}
