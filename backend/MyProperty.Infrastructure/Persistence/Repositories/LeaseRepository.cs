using Microsoft.EntityFrameworkCore;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Domain.Entities;

namespace MyProperty.Infrastructure.Persistence.Repositories;

internal sealed class LeaseRepository(AppDbContext db) : ILeaseRepository
{
    public Task<Lease?> GetByIdAsync(Guid id, CancellationToken ct) =>
        db.Leases.FirstOrDefaultAsync(l => l.Id == id, ct);

    public Task AddAsync(Lease lease, CancellationToken ct)
        => db.Leases.AddAsync(lease, ct).AsTask();
}
