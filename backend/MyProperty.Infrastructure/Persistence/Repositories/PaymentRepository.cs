using Microsoft.EntityFrameworkCore;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Domain.Entities;

namespace MyProperty.Infrastructure.Persistence.Repositories;

internal sealed class PaymentRepository(AppDbContext db) : IPaymentRepository
{
    public Task<Payment?> GetByIdWithLeaseAsync(Guid id, CancellationToken ct) =>
        db.Payments
            .Include(p => p.Lease)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

    public Task AddAsync(Payment payment, CancellationToken ct)
        => db.Payments.AddAsync(payment, ct).AsTask();

    public Task SaveChangesAsync(CancellationToken ct) => db.SaveChangesAsync(ct);
}
