using MyProperty.Application.Common;
using MyProperty.Application.Landlord.Queries.GetUpcomingPayments;
using MyProperty.Domain.Entities;

namespace MyProperty.Application.Common.Interfaces;

/// <summary>
/// Repository for the <see cref="Payment"/> aggregate.
/// Methods are named for use cases, not CRUD primitives, per the project's
/// thin-per-aggregate repository convention.
/// </summary>
public interface IPaymentRepository
{
    /// <summary>Returns Outstanding payments due within the next 30 days for the given landlord.</summary>
    Task<PagedResult<UpcomingPaymentDto>> GetUpcomingForLandlordAsync(
        Guid landlordId, int page, int pageSize, CancellationToken ct);

    /// <summary>
    /// Loads a payment with its parent <see cref="Lease"/> eagerly included.
    /// Used by every state-transition handler that needs to verify resource
    /// ownership (landlord owns the lease, or tenant owns the lease).
    /// Returns <c>null</c> if no payment with the given id exists.
    /// </summary>
    Task<Payment?> GetByIdWithLeaseAsync(Guid id, CancellationToken ct);

    /// <summary>
    /// Adds a payment to the change tracker. Caller is responsible for
    /// invoking <see cref="SaveChangesAsync"/>.
    /// </summary>
    Task AddAsync(Payment payment, CancellationToken ct);

    /// <summary>
    /// Flushes the unit of work for this aggregate. Mirrors the pattern used
    /// by <c>IInviteRepository.SaveChangesAsync</c>.
    /// </summary>
    Task SaveChangesAsync(CancellationToken ct);
}
