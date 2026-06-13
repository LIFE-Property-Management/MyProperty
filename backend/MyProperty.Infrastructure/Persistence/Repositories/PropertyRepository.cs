using Microsoft.EntityFrameworkCore;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Properties.Queries.GetPropertyById;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;

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

    public async Task<PropertyDetailDto?> GetDetailAsync(Guid propertyId, Guid landlordId, CancellationToken ct)
    {
        var property = await db.Properties
            .FirstOrDefaultAsync(p => p.Id == propertyId && p.LandlordId == landlordId, ct);

        if (property is null) return null;

        var leases = await db.Leases
            .Include(l => l.Tenant)
            .Where(l => l.PropertyId == propertyId)
            .OrderByDescending(l => l.StartDate)
            .ToListAsync(ct);

        var tenants = leases.Select(l => new PropertyTenantDto(
            l.Id,
            l.TenantId,
            $"{l.Tenant!.FirstName} {l.Tenant.LastName}",
            l.Tenant.Email,
            l.StartDate,
            l.EndDate,
            l.MonthlyRent,
            l.Currency,
            l.Status.ToString())).ToList();

        // Per-property occupancy (D7). HasActiveLease reuses the already-loaded
        // leases; the pending invite id is fetched directly (effective-pending:
        // Pending and not past ExpiresAt, matching the preview's expiry semantics)
        // so HasPendingInvite = the id is present and "Cancel invitation" has its id.
        // TODO(guard rail): a property may have several pending invites; this picks
        // the most recent as "the" one until the one-pending-invite-per-property
        // invariant is enforced (see backend/CLAUDE.md § Invites).
        var hasActiveLease = leases.Any(l => l.Status == LeaseStatus.Active);
        var pendingInviteId = await db.Invites
            .Where(i => i.PropertyId == propertyId
                && i.Status == InviteStatus.Pending
                && i.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => (Guid?)i.Id)
            .FirstOrDefaultAsync(ct);

        return new PropertyDetailDto(property.Id, property.Name, property.Address,
            property.UnitNumber, property.PropertyType, property.CreatedAt,
            hasActiveLease, pendingInviteId.HasValue, pendingInviteId, tenants);
    }

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
