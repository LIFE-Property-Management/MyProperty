using MyProperty.Domain.Entities;

namespace MyProperty.Application.Common.Interfaces;

public interface ILeaseRepository
{
    /// <summary>
    /// Adds a Lease to the change tracker. Does NOT save —
    /// IInviteRepository.SaveChangesAsync flushes the unit of work.
    /// </summary>
    Task AddAsync(Lease lease, CancellationToken ct);
}
