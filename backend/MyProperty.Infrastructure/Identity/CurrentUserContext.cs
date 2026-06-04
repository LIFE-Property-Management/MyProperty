using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Domain.Entities;

namespace MyProperty.Infrastructure.Identity;

/// <summary>
/// Default <see cref="ICurrentUserContext"/> implementation. Wraps
/// <see cref="ICurrentUser"/> + <see cref="IUserRepository"/> so handlers no
/// longer repeat the null-check + lookup, and so the single remaining
/// <c>ClaimsPrincipal</c> dereference is guarded here rather than via a
/// null-forgiving <c>Principal!</c> scattered across handlers.
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
        if (currentUser.Principal is null)             // guarded — no more NRE
            throw new ForbiddenException("Authentication required.");

        return await users.GetOrSyncFromClaimsAsync(currentUser.Principal, ct);
    }
}
