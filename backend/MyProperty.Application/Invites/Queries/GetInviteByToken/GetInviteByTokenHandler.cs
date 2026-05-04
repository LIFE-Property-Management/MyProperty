using System.Security.Cryptography;
using System.Text;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Domain.Enums;

namespace MyProperty.Application.Invites.Queries.GetInviteByToken;

public sealed class GetInviteByTokenHandler(IInviteRepository invites)
{
    public async Task<InvitePreviewDto> Handle(GetInviteByTokenQuery query, CancellationToken ct)
    {
        var tokenHash = HashToken(query.Token);

        var invite = await invites.GetByTokenHashAsync(tokenHash, ct)
            ?? throw new NotFoundException("Invite", "token");

        if (invite.Status != InviteStatus.Pending)
            throw new NotFoundException("Invite", "token");

        if (invite.ExpiresAt <= DateTime.UtcNow)
            throw new NotFoundException("Invite", "token");

        return new InvitePreviewDto(
            PropertyName:        invite.Property!.Name,
            PropertyAddress:     invite.Property.Address,
            LandlordFullName:    $"{invite.Landlord!.FirstName} {invite.Landlord.LastName}",
            TenantFirstName:     invite.FirstName,
            TenantLastName:      invite.LastName,
            TenantEmail:         invite.Email,
            ProposedStartDate:   invite.ProposedStartDate,
            ProposedEndDate:     invite.ProposedEndDate,
            ProposedMonthlyRent: invite.ProposedMonthlyRent,
            Currency:            invite.Currency,
            ExpiresAt:           invite.ExpiresAt);
    }

    private static string HashToken(string plainToken)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(plainToken)))
            .ToLowerInvariant();
}
