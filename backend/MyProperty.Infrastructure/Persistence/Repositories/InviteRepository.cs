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

    public Task<Invite?> GetByIdAsync(Guid id, CancellationToken ct)
        => db.Invites
            .Include(i => i.Property)
            .Include(i => i.Landlord)
            .FirstOrDefaultAsync(i => i.Id == id, ct);

    public async Task<(IReadOnlyList<Invite> Items, int TotalCount)> ListByLandlordAsync(
        Guid landlordId, int page, int pageSize, InviteStatus? statusFilter, CancellationToken ct)
    {
        var query = db.Invites
            .Include(i => i.Property)
            .Where(i => i.LandlordId == landlordId);

        if (statusFilter is { } status)
            query = query.Where(i => i.Status == status);

        var ordered = query.OrderByDescending(i => i.CreatedAt);

        var totalCount = await ordered.CountAsync(ct);
        var items = await ordered
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public async Task<IReadOnlyDictionary<Guid, Guid>> GetPendingInviteIdsByPropertyAsync(
        IReadOnlyCollection<Guid> propertyIds, CancellationToken ct)
    {
        if (propertyIds.Count == 0) return new Dictionary<Guid, Guid>();

        var now = DateTime.UtcNow;
        var matches = await db.Invites
            .Where(i => i.Status == InviteStatus.Pending
                && i.ExpiresAt > now
                && propertyIds.Contains(i.PropertyId))
            .Select(i => new { i.PropertyId, i.Id, i.CreatedAt })
            .ToListAsync(ct);

        // TODO(guard rail): a property may currently have multiple pending invites.
        // Until the one-pending-invite-per-property invariant is enforced, pick the
        // most recent as "the" pending invite so the id is stable and meaningful.
        return matches
            .GroupBy(m => m.PropertyId)
            .ToDictionary(
                g => g.Key,
                g => g.OrderByDescending(m => m.CreatedAt).First().Id);
    }

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
