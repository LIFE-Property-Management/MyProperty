using MyProperty.Domain.Common;
using MyProperty.Domain.Enums;

namespace MyProperty.Domain.Entities;

public class User : BaseEntity
{
    public required string KeycloakSubId { get; set; }
    public required string Email { get; set; }
    public required string FirstName { get; set; }
    public required string LastName { get; set; }
    public string? Phone { get; set; }
    public required UserRole Role { get; set; }

    public TenantAccountStatus? AccountStatus { get; set; }

    public ICollection<Property> OwnedProperties { get; set; } = [];
    public ICollection<Lease> Leases { get; set; } = [];
    public ICollection<Invite> SentInvites { get; set; } = [];
}
