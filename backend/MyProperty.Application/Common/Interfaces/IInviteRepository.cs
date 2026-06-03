using MyProperty.Domain.Entities;

namespace MyProperty.Application.Common.Interfaces;

public interface IInviteRepository
{
    Task AddAsync(Invite invite, CancellationToken ct);

    /// <summary>
    /// Loads invite with Property and Landlord eagerly included.
    /// Returns null if not found. Does NOT filter by Status or ExpiresAt —
    /// caller decides what to do with non-Pending or expired invites.
    /// </summary>
    Task<Invite?> GetByTokenHashAsync(string tokenHash, CancellationToken ct);

    /// <summary>
    /// Unit-of-work commit. Flushes invite changes plus any other entity
    /// changes tracked by the shared scoped DbContext (e.g. a Lease added
    /// via ILeaseRepository during accept).
    /// </summary>
    Task SaveChangesAsync(CancellationToken ct);

    /// <summary>
    /// Returns all <c>Pending</c> invites whose <c>ExpiresAt</c> is before
    /// <paramref name="asOfUtc"/>. Used by the hourly <c>MarkExpiredInvites</c>
    /// job, which marks each as <c>Expired</c> through the change tracker so the
    /// auditing interceptor stamps <c>UpdatedAt</c> — callers must then invoke
    /// <see cref="SaveChangesAsync"/>.
    /// </summary>
    Task<IReadOnlyList<Invite>> GetPendingExpiredAsOfAsync(DateTime asOfUtc, CancellationToken ct);

    /// <summary>
    /// Hard-deletes <c>Expired</c> invites created before <paramref name="cutoffUtc"/>
    /// in a single set-based SQL <c>DELETE</c> (no entity loading, no change
    /// tracker — deliberately bypasses the auditing interceptor for this true
    /// purge). Returns the number of rows deleted. Used by the daily
    /// <c>OrphanCleanup</c> job.
    /// </summary>
    Task<int> DeleteExpiredOlderThanAsync(DateTime cutoffUtc, CancellationToken ct);
}
