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
}
