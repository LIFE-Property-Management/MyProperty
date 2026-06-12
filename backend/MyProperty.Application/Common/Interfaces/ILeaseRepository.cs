using MyProperty.Domain.Entities;

namespace MyProperty.Application.Common.Interfaces;

public interface ILeaseRepository
{
    /// <summary>Loads a lease by id. Returns null if not found.</summary>
    Task<Lease?> GetByIdAsync(Guid id, CancellationToken ct);

    /// <summary>
    /// Adds a Lease to the change tracker. Does NOT save —
    /// IInviteRepository.SaveChangesAsync flushes the unit of work for the accept-invite flow.
    /// </summary>
    Task AddAsync(Lease lease, CancellationToken ct);

    Task SaveChangesAsync(CancellationToken ct);

    /// <summary>
    /// Paginated list of leases for a landlord with Property and Tenant included,
    /// ordered by StartDate descending.
    /// </summary>
    Task<(IReadOnlyList<Lease> Items, int TotalCount)> ListByLandlordAsync(
        Guid landlordId, int page, int pageSize, CancellationToken ct);

    /// <summary>
    /// Returns the active lease for a tenant with Property and Landlord included.
    /// Returns null if no active lease exists.
    /// </summary>
    Task<Lease?> GetActiveByTenantIdAsync(Guid tenantId, CancellationToken ct);

    /// <summary>
    /// Returns the most recent lease linking the tenant to the landlord,
    /// with Property, Tenant, and Payments included.
    /// Returns null if no such lease exists (used for authorization in tenant-detail).
    /// </summary>
    Task<Lease?> GetLeaseWithPaymentsByTenantAndLandlordAsync(
        Guid tenantId, Guid landlordId, CancellationToken ct);

    /// <summary>
    /// Returns active leases for the landlord whose EndDate falls within
    /// <paramref name="daysThreshold"/> days from today, ordered by EndDate ascending.
    /// </summary>
    Task<IReadOnlyList<Lease>> ListExpiringSoonAsync(
        Guid landlordId, int daysThreshold, CancellationToken ct);

    /// <summary>
    /// Paginated list of distinct active tenants for a landlord. Returns one lease
    /// per tenant (the most recent by StartDate) with Property and Tenant included.
    /// Used to render the landlord Tenants page — see <c>portals.md</c>.
    /// Post-lease (read-only) tenants are not included; see M4 backlog for the
    /// follow-up that adds them.
    /// </summary>
    Task<(IReadOnlyList<Lease> Items, int TotalCount)> ListActiveTenantsByLandlordAsync(
        Guid landlordId, int page, int pageSize, CancellationToken ct);

    /// <summary>
    /// Returns active leases system-wide whose EndDate is between <paramref name="today"/>
    /// and <paramref name="daysThreshold"/> days after it (inclusive), ordered by EndDate,
    /// with Tenant, Landlord, and Property included (the job builds emails from them).
    /// <paramref name="today"/> is supplied by the caller so the job's clock is the single
    /// source of "today". Used exclusively by <c>LeaseExpiringSoonJob</c>.
    /// </summary>
    Task<IReadOnlyList<Lease>> ListAllExpiringSoonAsync(DateOnly today, int daysThreshold, CancellationToken ct);

    /// <summary>
    /// True if the property has at least one Active lease. Used to block property deletion.
    /// </summary>
    Task<bool> HasActiveLeaseForPropertyAsync(Guid propertyId, CancellationToken ct);

    /// <summary>
    /// Of the given property ids, returns a map from property id to its Active lease
    /// id (only for properties that have one). Single set-based query — used to
    /// compute per-property occupancy (<c>HasActiveLease</c> = key present) and the
    /// <c>ActiveLeaseId</c> that drives "Cancel lease" on the landlord property list,
    /// without an N+1 of per-property existence checks. The map is well-defined
    /// (one id per property) by the single-active-lease-per-property invariant.
    /// </summary>
    Task<IReadOnlyDictionary<Guid, Guid>> GetActiveLeaseIdsByPropertyAsync(
        IReadOnlyCollection<Guid> propertyIds, CancellationToken ct);
}
