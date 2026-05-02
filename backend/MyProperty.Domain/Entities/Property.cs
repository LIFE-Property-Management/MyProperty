using MyProperty.Domain.Common;

namespace MyProperty.Domain.Entities;

public class Property : BaseEntity
{
    public required Guid LandlordId { get; set; }
    public User? Landlord { get; set; }

    public required string Name { get; set; }
    public required string Address { get; set; }
    public string? UnitNumber { get; set; }

    public ICollection<Lease> Leases { get; set; } = [];
    public ICollection<Invite> Invites { get; set; } = [];
}
