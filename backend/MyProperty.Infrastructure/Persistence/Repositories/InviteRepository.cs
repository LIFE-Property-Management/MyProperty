using Microsoft.EntityFrameworkCore;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;

namespace MyProperty.Infrastructure.Persistence.Repositories;

internal sealed class InviteRepository(AppDbContext db) : IInviteRepository
{
    public Task AddAsync(Invite invite, CancellationToken ct)
        => db.Invites.AddAsync(invite, ct).AsTask();

    public Task<Invite?> GetByTokenHashAsync(string tokenHash, CancellationToken ct)
        => db.Invites
            .Include(i => i.Property)
            .Include(i => i.Landlord)
            .FirstOrDefaultAsync(i => i.TokenHash == tokenHash, ct);

    public Task SaveChangesAsync(CancellationToken ct)
        => db.SaveChangesAsync(ct);

    public async Task<IReadOnlyList<Invite>> GetPendingExpiredAsOfAsync(DateTime asOfUtc, CancellationToken ct)
        => await db.Invites
            .Where(i => i.Status == InviteStatus.Pending && i.ExpiresAt < asOfUtc)
            .ToListAsync(ct);

    public Task<int> DeleteExpiredOlderThanAsync(DateTime cutoffUtc, CancellationToken ct)
        // The global soft-delete query filter is auto-applied to the WHERE;
        // Expired orphans are never soft-deleted, so they're included.
        => db.Invites
            .Where(i => i.Status == InviteStatus.Expired && i.CreatedAt < cutoffUtc)
            .ExecuteDeleteAsync(ct);
}
