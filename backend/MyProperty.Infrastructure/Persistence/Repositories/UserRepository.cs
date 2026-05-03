using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Domain.Entities;

namespace MyProperty.Infrastructure.Persistence.Repositories;

internal sealed class UserRepository(AppDbContext db) : IUserRepository
{
    public Task<User?> GetByKeycloakSubIdAsync(string keycloakSubId, CancellationToken ct) =>
        db.Users.FirstOrDefaultAsync(u => u.KeycloakSubId == keycloakSubId, ct);

    public Task<User?> GetByIdAsync(Guid id, CancellationToken ct) =>
        db.Users.FirstOrDefaultAsync(u => u.Id == id, ct);

    public Task<User?> GetByEmailAsync(string email, CancellationToken ct) =>
        db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);

    public async Task<User> GetOrSyncFromClaimsAsync(ClaimsPrincipal principal, CancellationToken ct)
    {
        if (principal.Identity?.IsAuthenticated != true)
        {
            throw new InvalidOperationException(
                "GetOrSyncFromClaimsAsync called with an unauthenticated principal.");
        }

        var sub = principal.FindFirst("sub")?.Value
            ?? throw new InvalidOperationException(
                "Authenticated principal is missing the 'sub' claim.");

        var email = principal.FindFirst("email")?.Value ?? string.Empty;
        var firstName = principal.FindFirst("given_name")?.Value ?? string.Empty;
        var lastName = principal.FindFirst("family_name")?.Value ?? string.Empty;
        var phone = principal.FindFirst("phone_number")?.Value;

        var existing = await db.Users.FirstOrDefaultAsync(u => u.KeycloakSubId == sub, ct);

        if (existing is null)
        {
            var created = new User
            {
                KeycloakSubId = sub,
                Email = email,
                FirstName = firstName,
                LastName = lastName,
                Phone = phone,
            };
            await db.Users.AddAsync(created, ct);
            await db.SaveChangesAsync(ct);
            return created;
        }

        var changed = false;
        if (!string.IsNullOrEmpty(email) && existing.Email != email)
        {
            existing.Email = email;
            changed = true;
        }
        if (!string.IsNullOrEmpty(firstName) && existing.FirstName != firstName)
        {
            existing.FirstName = firstName;
            changed = true;
        }
        if (!string.IsNullOrEmpty(lastName) && existing.LastName != lastName)
        {
            existing.LastName = lastName;
            changed = true;
        }
        
        if (phone is not null && existing.Phone != phone)
        {
            existing.Phone = phone;
            changed = true;
        }

        if (changed)
        {
            await db.SaveChangesAsync(ct);
        }

        return existing;
    }

    public async Task AddAsync(User user, CancellationToken ct)
    {
        await db.Users.AddAsync(user, ct);
    }
}
