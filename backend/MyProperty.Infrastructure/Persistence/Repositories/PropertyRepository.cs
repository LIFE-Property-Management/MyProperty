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
}
