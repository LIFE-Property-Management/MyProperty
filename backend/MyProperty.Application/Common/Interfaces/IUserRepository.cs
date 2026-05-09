using System.Security.Claims;
using MyProperty.Domain.Entities;

namespace MyProperty.Application.Common.Interfaces;

/// <summary>
/// Repository for the <see cref="User"/> aggregate. The User table mirrors
/// Keycloak identities — population is driven by <see cref="GetOrSyncFromClaimsAsync"/>,
/// not by a public registration endpoint.
/// </summary>
public interface IUserRepository
{
    /// <summary>
    /// Looks up a user by their Keycloak subject ID (the JWT <c>sub</c> claim).
    /// Returns <c>null</c> if no row exists yet.
    /// </summary>
    Task<User?> GetByKeycloakSubIdAsync(string keycloakSubId, CancellationToken ct);

    /// <summary>
    /// Looks up a user by their domain primary key.
    /// </summary>
    Task<User?> GetByIdAsync(Guid id, CancellationToken ct);

    /// <summary>
    /// Looks up a user by email. Email is unique across the table.
    /// </summary>
    Task<User?> GetByEmailAsync(string email, CancellationToken ct);

    /// <summary>
    /// Reads the JWT claims off <paramref name="principal"/>, ensures a matching
    /// <see cref="User"/> row exists, updates email/name/phone if the claims have
    /// drifted, and returns the entity. Persists changes via SaveChangesAsync.
    /// Throws <see cref="InvalidOperationException"/> if the principal is not
    /// authenticated or is missing a <c>sub</c> claim.
    /// </summary>
    Task<User> GetOrSyncFromClaimsAsync(ClaimsPrincipal principal, CancellationToken ct);

    /// <summary>
    /// Adds a new user to the change tracker. Caller is responsible for SaveChangesAsync.
    /// </summary>
    Task AddAsync(User user, CancellationToken ct);
}
