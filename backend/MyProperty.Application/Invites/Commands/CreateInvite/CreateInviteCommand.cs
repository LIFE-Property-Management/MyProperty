namespace MyProperty.Application.Invites.Commands.CreateInvite;

public sealed record CreateInviteCommand(
    Guid PropertyId,
    string Email,
    string FirstName,
    string LastName,
    DateOnly ProposedStartDate,
    DateOnly ProposedEndDate,
    decimal ProposedMonthlyRent,
    string Currency);

// Co-located: only exists as the handler return type.
public sealed record InviteCreatedDto(Guid InviteId, DateTime ExpiresAt);
