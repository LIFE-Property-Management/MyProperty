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
}
