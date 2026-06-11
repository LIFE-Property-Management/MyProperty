using FluentValidation;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;
using MyProperty.Domain.Enums;

namespace MyProperty.Application.Invites.Queries.GetInviteByToken;

public sealed class GetInviteByTokenHandler(
    IValidator<GetInviteByTokenQuery> validator,
    IInviteRepository invites)
{
    public async Task<InvitePreviewDto> Handle(GetInviteByTokenQuery query, CancellationToken ct)
    {
        await validator.EnsureValidAsync(query, ct);

        var tokenHash = InviteTokenHasher.Hash(query.Token);

        // Only a truly unknown token-hash is hidden as 404 (don't confirm token
        // existence to an enumerator). A resolved invite returns 200 with its
        // status so the accept page can render a status-specific view (D3).
        var invite = await invites.GetByTokenHashAsync(tokenHash, ct)
            ?? throw new NotFoundException("Invite", "token");

        // A Pending invite whose ExpiresAt has passed but which the hourly
        // MarkExpiredInvites job hasn't swept yet is effectively Expired — report
        // it as such so the frontend never shows an accept form for a dead link.
        var status = invite.Status == InviteStatus.Pending && invite.ExpiresAt <= DateTime.UtcNow
            ? InviteStatus.Expired
            : invite.Status;

        return new InvitePreviewDto(
            Status: status,
            PropertyName: invite.Property!.Name,
            PropertyAddress: invite.Property.Address,
            LandlordFullName: $"{invite.Landlord!.FirstName} {invite.Landlord.LastName}",
            TenantFirstName: invite.FirstName,
            TenantLastName: invite.LastName,
            TenantEmail: invite.Email,
            ProposedStartDate: invite.ProposedStartDate,
            ProposedEndDate: invite.ProposedEndDate,
            ProposedMonthlyRent: invite.ProposedMonthlyRent,
            Currency: invite.Currency,
            ExpiresAt: invite.ExpiresAt);
    }
}
