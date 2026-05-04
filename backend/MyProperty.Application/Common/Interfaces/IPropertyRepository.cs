using MyProperty.Domain.Entities;

namespace MyProperty.Application.Common.Interfaces;

public interface IPropertyRepository
{
    /// <summary>
    /// Loads property with Landlord eagerly included. Returns null if not found.
    /// </summary>
    Task<Property?> GetByIdAsync(Guid id, CancellationToken ct);
}
