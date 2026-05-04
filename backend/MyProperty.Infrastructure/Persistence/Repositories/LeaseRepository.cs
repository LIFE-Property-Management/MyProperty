using MyProperty.Application.Common.Interfaces;
using MyProperty.Domain.Entities;

namespace MyProperty.Infrastructure.Persistence.Repositories;

internal sealed class LeaseRepository(AppDbContext db) : ILeaseRepository
{
    public Task AddAsync(Lease lease, CancellationToken ct)
        => db.Leases.AddAsync(lease, ct).AsTask();
}
