using MyProperty.Domain.Common;
using MyProperty.Domain.Enums;

namespace MyProperty.Domain.Entities;

public class Invite : BaseEntity
{
    public required Guid LandlordId { get; set; }
    public User? Landlord { get; set; }

    public required Guid PropertyId { get; set; }
    public Property? Property { get; set; }

    public required string Email { get; set; }
    public required string FirstName { get; set; }
    public required string LastName { get; set; }

    public required string TokenHash { get; set; }
    public required InviteStatus Status { get; set; } = InviteStatus.Pending;
    public required DateTime ExpiresAt { get; set; }

    public DateTime? AcceptedAt { get; set; }
    public DateTime? RejectedAt { get; set; }

    public required DateOnly ProposedStartDate { get; set; }
    public required DateOnly ProposedEndDate { get; set; }
    public required decimal ProposedMonthlyRent { get; set; }
    public required string Currency { get; set; }
}
