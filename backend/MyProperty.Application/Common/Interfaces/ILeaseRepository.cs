using MyProperty.Domain.Entities;

namespace MyProperty.Application.Common.Interfaces;

public interface ILeaseRepository
{
    /// <summary>
    /// Loads a lease by id. Used by <c>CreatePaymentHandler</c> to verify
    /// landlord ownership and read currency before creating an Outstanding
    /// payment row. Returns <c>null</c> if no lease with the given id exists.
    /// </summary>
    Task<Lease?> GetByIdAsync(Guid id, CancellationToken ct);

    /// <summary>
    /// Adds a Lease to the change tracker. Does NOT save —
    /// IInviteRepository.SaveChangesAsync flushes the unit of work.
    /// </summary>
    Task AddAsync(Lease lease, CancellationToken ct);
}
