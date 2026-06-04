using MyProperty.Domain.Entities;

namespace MyProperty.Application.Common.Interfaces;

/// <summary>
/// Resolves the authenticated caller to the internal <see cref="User"/> entity,
/// centralizing the <c>KeycloakSubId → User</c> lookup that the payment handlers
/// previously duplicated and guarding the <c>ClaimsPrincipal</c> access that the
/// invite/landlord handlers previously did with a null-forgiving <c>Principal!</c>.
/// </summary>
public interface ICurrentUserContext
{
    /// <summary>
    /// Resolves the authenticated user by Keycloak sub. Throws
    /// <see cref="Common.Exceptions.ForbiddenException"/> if unauthenticated or
    /// not present in the user table.
    /// </summary>
    Task<User> GetUserAsync(CancellationToken ct);

    /// <summary>
    /// Resolves-or-syncs the authenticated user from claims. Throws
    /// <see cref="Common.Exceptions.ForbiddenException"/> if there is no
    /// authenticated principal.
    /// </summary>
    Task<User> GetOrSyncUserAsync(CancellationToken ct);
}
