using MyProperty.Domain.Entities;

namespace MyProperty.Application.Common.Interfaces;

/// <summary>
/// Resolves the authenticated caller to the internal <see cref="User"/> entity,
/// centralizing the <c>KeycloakSubId → User</c> lookup so handlers never touch
/// identity primitives directly.
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
    /// Resolves-or-syncs the authenticated user from the current identity claims.
    /// Throws <see cref="Common.Exceptions.ForbiddenException"/> if unauthenticated.
    /// </summary>
    Task<User> GetOrSyncUserAsync(CancellationToken ct);
}
