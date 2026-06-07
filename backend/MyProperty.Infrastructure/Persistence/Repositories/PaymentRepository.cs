using Microsoft.EntityFrameworkCore;
using MyProperty.Application.Common;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Landlord.Queries.GetUpcomingPayments;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;

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

    public async Task<PagedResult<UpcomingPaymentDto>> GetUpcomingForLandlordAsync(
        Guid landlordId, int page, int pageSize, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var cutoff = today.AddDays(30);

        var query = db.Payments
            .Where(p => p.Lease!.LandlordId == landlordId
                     && p.Status == PaymentStatus.Outstanding
                     && p.DueDate >= today
                     && p.DueDate <= cutoff)
            .OrderBy(p => p.DueDate);

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new UpcomingPaymentDto(
                p.Id,
                p.Lease!.TenantId,
                p.Lease.Tenant!.FirstName + " " + p.Lease.Tenant.LastName,
                p.Lease.Property!.Name,
                p.Amount,
                p.Currency,
                p.DueDate))
            .ToListAsync(ct);

        return new PagedResult<UpcomingPaymentDto>(items, page, pageSize, totalCount);
    }
}
