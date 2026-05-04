using MyProperty.Domain.Common;
using MyProperty.Domain.Enums;

namespace MyProperty.Domain.Entities;

public class Lease : BaseEntity
{
    public required Guid LandlordId { get; set; }
    public User? Landlord { get; set; }

    public required Guid PropertyId { get; set; }
    public Property? Property { get; set; }

    public required Guid TenantId { get; set; }
    public User? Tenant { get; set; }

    public required DateOnly StartDate { get; set; }
    public required DateOnly EndDate { get; set; }
    public required decimal MonthlyRent { get; set; }
    public required string Currency { get; set; }
    public required LeaseStatus Status { get; set; } = LeaseStatus.Active;

    public ICollection<Payment> Payments { get; set; } = [];
}
