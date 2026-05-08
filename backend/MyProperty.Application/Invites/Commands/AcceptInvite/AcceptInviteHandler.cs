using System.Security.Cryptography;
using System.Text;
using FluentValidation;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;
using MyProperty.Application.Invites.Events;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;

namespace MyProperty.Application.Invites.Commands.AcceptInvite;

public sealed class AcceptInviteHandler(
    IValidator<AcceptInviteCommand> validator,
    IInviteRepository invites,
    ILeaseRepository leases,
    IUserRepository users,
    ICurrentUser currentUser,
    ILandlordDashboardCache dashboardCache,
    IEventPublisher publisher)
{
    public async Task<InviteAcceptedDto> Handle(AcceptInviteCommand cmd, CancellationToken ct)
    {
        await validator.EnsureValidAsync(cmd, ct);

        var tokenHash = HashToken(cmd.Token);

        var invite = await invites.GetByTokenHashAsync(tokenHash, ct)
            ?? throw new NotFoundException("Invite", "token");

        if (invite.Status != InviteStatus.Pending)
            throw new NotFoundException("Invite", "token");

        if (invite.ExpiresAt <= DateTime.UtcNow)
            throw new NotFoundException("Invite", "token");

        var user = await users.GetOrSyncFromClaimsAsync(currentUser.Principal!, ct);

        if (!string.Equals(user.Email, invite.Email, StringComparison.OrdinalIgnoreCase))
            throw new ForbiddenException("This invite was sent to a different email address.");

        var lease = new Lease
        {
            LandlordId = invite.LandlordId,
            PropertyId = invite.PropertyId,
            TenantId = user.Id,
            StartDate = invite.ProposedStartDate,
            EndDate = invite.ProposedEndDate,
            MonthlyRent = invite.ProposedMonthlyRent,
            Currency = invite.Currency,
            Status = LeaseStatus.Active,
        };

        await leases.AddAsync(lease, ct);

        invite.Status = InviteStatus.Accepted;
        invite.AcceptedAt = DateTime.UtcNow;

        await invites.SaveChangesAsync(ct);

        // The new lease changes the landlord's "active leases / tenants"
        // counters; drop the cached dashboard so the next read repopulates.
        await dashboardCache.InvalidateAsync(invite.LandlordId, ct);

        await publisher.PublishAsync(
            new InviteAcceptedEvent(
                invite.Id, lease.Id, user.Id, invite.LandlordId, invite.AcceptedAt!.Value),
            ct);

        return new InviteAcceptedDto(invite.Id, lease.Id);
    }

    private static string HashToken(string plainToken)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(plainToken)))
            .ToLowerInvariant();
}
