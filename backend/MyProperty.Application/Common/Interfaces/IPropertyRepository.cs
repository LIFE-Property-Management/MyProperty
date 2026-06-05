using MyProperty.Application.Properties.Queries.GetPropertyById;
using MyProperty.Domain.Entities;

namespace MyProperty.Application.Common.Interfaces;

public interface IPropertyRepository
{
    /// <summary>Loads property with Landlord eagerly included. Returns null if not found.</summary>
    Task<Property?> GetByIdAsync(Guid id, CancellationToken ct);

    /// <summary>Returns property detail with all leases and tenant info for the given landlord.</summary>
    Task<PropertyDetailDto?> GetDetailAsync(Guid propertyId, Guid landlordId, CancellationToken ct);

    Task AddAsync(Property property, CancellationToken ct);
    Task SaveChangesAsync(CancellationToken ct);

    /// <summary>Paginated list of properties for a landlord, ordered by creation date descending.</summary>
    Task<(IReadOnlyList<Property> Items, int TotalCount)> ListByLandlordAsync(
        Guid landlordId, int page, int pageSize, CancellationToken ct);
}
