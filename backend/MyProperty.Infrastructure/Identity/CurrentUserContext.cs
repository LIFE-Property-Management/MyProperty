using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Domain.Entities;

namespace MyProperty.Infrastructure.Identity;

/// <summary>
/// Default <see cref="ICurrentUserContext"/> implementation. Wraps
/// <see cref="ICurrentUser"/> + <see cref="IUserRepository"/> so handlers no
/// longer repeat the null-check + lookup.
/// </summary>
public sealed class CurrentUserContext(ICurrentUser currentUser, IUserRepository users) : ICurrentUserContext
{
    public async Task<User> GetUserAsync(CancellationToken ct)
    {
        if (currentUser.KeycloakSubId is null)
            throw new ForbiddenException("Authentication required.");

        return await users.GetByKeycloakSubIdAsync(currentUser.KeycloakSubId, ct)
            ?? throw new ForbiddenException("Authenticated user not found in user table.");
    }

    public async Task<User> GetOrSyncUserAsync(CancellationToken ct)
    {
        if (currentUser.KeycloakSubId is null)
            throw new ForbiddenException("Authentication required.");

        return await users.GetOrSyncAsync(
            currentUser.KeycloakSubId,
            currentUser.Email,
            currentUser.FirstName,
            currentUser.LastName,
            currentUser.Phone,
            ct);
    }
}
