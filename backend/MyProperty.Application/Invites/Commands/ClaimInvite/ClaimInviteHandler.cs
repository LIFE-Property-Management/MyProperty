using FluentValidation;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;
using MyProperty.Application.Invites.Commands.AcceptInvite;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;

namespace MyProperty.Application.Invites.Commands.ClaimInvite;

/// <summary>
/// Returning-tenant accept (D1). Mirrors <c>AcceptInviteHandler</c> but skips
/// Keycloak provisioning and User-row creation: the caller is already an
/// authenticated tenant. We verify the JWT-resolved email matches the invite
/// email (else 403), create the Lease, and mark the invite Accepted.
/// </summary>
public sealed class ClaimInviteHandler(
    IValidator<ClaimInviteCommand> validator,
    IInviteRepository invites,
    ILeaseRepository leases,
    ICurrentUserContext currentUserContext,
    ILandlordDashboardCache dashboardCache)
{
    public async Task<InviteAcceptedDto> Handle(ClaimInviteCommand cmd, CancellationToken ct)
    {
        await validator.EnsureValidAsync(cmd, ct);

        var tenant = await currentUserContext.GetOrSyncUserAsync(ct);

        var tokenHash = InviteTokenHasher.Hash(cmd.Token);

        var invite = await invites.GetByTokenHashAsync(tokenHash, ct)
            ?? throw new NotFoundException("Invite", "token");

        if (invite.Status != InviteStatus.Pending)
            throw new NotFoundException("Invite", "token");

        if (invite.ExpiresAt <= DateTime.UtcNow)
            throw new NotFoundException("Invite", "token");

        // The invite is a bearer secret, but it was addressed to a specific
        // person — a logged-in tenant can only claim an invite sent to their
        // own email. Mismatch is 403, not 404: the token resolved fine.
        if (!string.Equals(tenant.Email, invite.Email, StringComparison.OrdinalIgnoreCase))
            throw new ForbiddenException("This invite was sent to a different email address.");

        var lease = new Lease
        {
            LandlordId = invite.LandlordId,
            PropertyId = invite.PropertyId,
            TenantId = tenant.Id,
            StartDate = invite.ProposedStartDate,
            EndDate = invite.ProposedEndDate,
            MonthlyRent = invite.ProposedMonthlyRent,
            Currency = invite.Currency,
        };
        await leases.AddAsync(lease, ct);

        invite.Status = InviteStatus.Accepted;
        invite.AcceptedAt = DateTime.UtcNow;

        await invites.SaveChangesAsync(ct);

        await dashboardCache.InvalidateAsync(invite.LandlordId, ct);

        return new InviteAcceptedDto(invite.Id, lease.Id);
    }
}
