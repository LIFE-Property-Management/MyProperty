using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;

namespace MyProperty.Application.Common.Interfaces;

public interface IInviteRepository
{
    Task AddAsync(Invite invite, CancellationToken ct);

    /// <summary>
    /// Loads a single invite by id with Property included. Returns null if not
    /// found. Does NOT filter by status — the caller (revoke/resend) decides.
    /// </summary>
    Task<Invite?> GetByIdAsync(Guid id, CancellationToken ct);

    /// <summary>
    /// Paginated list of the landlord's invites with Property included, ordered
    /// by CreatedAt descending. Optionally filtered to a single
    /// <paramref name="statusFilter"/>. Landlord-scoped — only the landlord's own
    /// invites are returned. Returns the page plus the total (filtered) count.
    /// </summary>
    Task<(IReadOnlyList<Invite> Items, int TotalCount)> ListByLandlordAsync(
        Guid landlordId, int page, int pageSize, InviteStatus? statusFilter, CancellationToken ct);

    /// <summary>
    /// Of the given property ids, returns a map from property id to its pending
    /// invite id — for properties that have an effective-pending invite
    /// (<c>Pending</c> and not past <c>ExpiresAt</c>; an expired-but-unswept invite
    /// is not "pending"). Single set-based query — used to compute per-property
    /// occupancy (<c>HasPendingInvite</c> = key present) and the <c>PendingInviteId</c>
    /// that drives "Cancel invitation", without an N+1 of per-property checks.
    /// TODO(guard rail): a property may currently have several pending invites; this
    /// returns one of them (treated as the single one). Enforce the
    /// one-pending-invite-per-property invariant in <c>CreateInviteHandler</c>
    /// (+ a DB constraint) later — see backend/CLAUDE.md § Invites.
    /// </summary>
    Task<IReadOnlyDictionary<Guid, Guid>> GetPendingInviteIdsByPropertyAsync(
        IReadOnlyCollection<Guid> propertyIds, CancellationToken ct);

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
