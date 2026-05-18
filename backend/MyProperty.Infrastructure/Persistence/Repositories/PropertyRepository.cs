using Microsoft.EntityFrameworkCore;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Domain.Entities;

namespace MyProperty.Infrastructure.Persistence.Repositories;

internal sealed class PropertyRepository(AppDbContext db) : IPropertyRepository
{
    public Task<Property?> GetByIdAsync(Guid id, CancellationToken ct)
        => db.Properties
            .Include(p => p.Landlord)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

    public Task AddAsync(Property property, CancellationToken ct)
        => db.Properties.AddAsync(property, ct).AsTask();

    public Task SaveChangesAsync(CancellationToken ct)
        => db.SaveChangesAsync(ct);

    public async Task<(IReadOnlyList<Property> Items, int TotalCount)> ListByLandlordAsync(
        Guid landlordId, int page, int pageSize, CancellationToken ct)
    {
        var query = db.Properties
            .Where(p => p.LandlordId == landlordId)
            .OrderByDescending(p => p.CreatedAt);

        var totalCount = await query.CountAsync(ct);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return (items, totalCount);
    }
}
