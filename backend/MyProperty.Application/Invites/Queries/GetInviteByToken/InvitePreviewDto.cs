namespace MyProperty.Application.Invites.Queries.GetInviteByToken;

public sealed record InvitePreviewDto(
    string PropertyName,
    string PropertyAddress,
    string LandlordFullName,
    string TenantFirstName,
    string TenantLastName,
    string TenantEmail,
    DateOnly ProposedStartDate,
    DateOnly ProposedEndDate,
    decimal ProposedMonthlyRent,
    string Currency,
    DateTime ExpiresAt);
