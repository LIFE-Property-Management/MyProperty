using Microsoft.EntityFrameworkCore;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;

namespace MyProperty.Infrastructure.Persistence.Repositories;

internal sealed class LeaseRepository(AppDbContext db) : ILeaseRepository
{
    public Task<Lease?> GetByIdAsync(Guid id, CancellationToken ct) =>
        db.Leases.FirstOrDefaultAsync(l => l.Id == id, ct);

    public Task AddAsync(Lease lease, CancellationToken ct)
        => db.Leases.AddAsync(lease, ct).AsTask();

    public Task SaveChangesAsync(CancellationToken ct)
        => db.SaveChangesAsync(ct);

    public async Task<(IReadOnlyList<Lease> Items, int TotalCount)> ListByLandlordAsync(
        Guid landlordId, int page, int pageSize, CancellationToken ct)
    {
        var query = db.Leases
            .Include(l => l.Property)
            .Include(l => l.Tenant)
            .Where(l => l.LandlordId == landlordId)
            .OrderByDescending(l => l.StartDate);

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public Task<Lease?> GetActiveByTenantIdAsync(Guid tenantId, CancellationToken ct)
        => db.Leases
            .Include(l => l.Property)
            .Include(l => l.Landlord)
            .FirstOrDefaultAsync(l => l.TenantId == tenantId && l.Status == LeaseStatus.Active, ct);

    public Task<Lease?> GetLeaseWithPaymentsByTenantAndLandlordAsync(
        Guid tenantId, Guid landlordId, CancellationToken ct)
        => db.Leases
            .Include(l => l.Property)
            .Include(l => l.Tenant)
            .Include(l => l.Payments)
            .Where(l => l.TenantId == tenantId && l.LandlordId == landlordId)
            .OrderByDescending(l => l.StartDate)
            .FirstOrDefaultAsync(ct);

    public async Task<IReadOnlyList<Lease>> ListExpiringSoonAsync(
        Guid landlordId, int daysThreshold, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var threshold = today.AddDays(daysThreshold);

        return await db.Leases
            .Include(l => l.Property)
            .Include(l => l.Tenant)
            .Where(l => l.LandlordId == landlordId
                     && l.Status == LeaseStatus.Active
                     && l.EndDate <= threshold)
            .OrderBy(l => l.EndDate)
            .ToListAsync(ct);
    }

    public async Task<(IReadOnlyList<Lease> Items, int TotalCount)> ListActiveTenantsByLandlordAsync(
        Guid landlordId, int page, int pageSize, CancellationToken ct)
    {
        // Step 1: get one lease ID per tenant (latest StartDate) — no Include here
        var latestLeaseIds = await db.Leases
            .Where(l => l.LandlordId == landlordId && l.Status == LeaseStatus.Active)
            .GroupBy(l => l.TenantId)
            .Select(g => g.OrderByDescending(l => l.StartDate).Select(l => l.Id).First())
            .ToListAsync(ct);

        var totalCount = latestLeaseIds.Count;

        // Step 2: load those leases with navigation properties, paginated
        var pageIds = latestLeaseIds
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToList();

        var items = await db.Leases
            .Include(l => l.Property)
            .Include(l => l.Tenant)
            .Where(l => pageIds.Contains(l.Id))
            .OrderByDescending(l => l.StartDate)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public async Task<IReadOnlyList<Lease>> ListAllExpiringSoonAsync(int daysThreshold, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var threshold = today.AddDays(daysThreshold);

        return await db.Leases
            .Include(l => l.Tenant)
            .Include(l => l.Landlord)
            .Include(l => l.Property)
            .Where(l => l.Status == LeaseStatus.Active
                && l.EndDate >= today
                && l.EndDate <= threshold)
            .OrderBy(l => l.EndDate)
            .ToListAsync(ct);
    }

    public Task<bool> HasActiveLeaseForPropertyAsync(Guid propertyId, CancellationToken ct)
        => db.Leases.AnyAsync(
            l => l.PropertyId == propertyId && l.Status == LeaseStatus.Active, ct);
}
