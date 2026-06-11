using FluentValidation;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Messaging;
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
    IUserAccountProvisioner provisioner,
    ILandlordDashboardCache dashboardCache,
    IEventPublisher events)
{
    public async Task<InviteAcceptedDto> Handle(AcceptInviteCommand cmd, CancellationToken ct)
    {
        await validator.EnsureValidAsync(cmd, ct);

        var tokenHash = InviteTokenHasher.Hash(cmd.Token);

        var invite = await invites.GetByTokenHashAsync(tokenHash, ct)
            ?? throw new NotFoundException("Invite", "token");

        if (invite.Status != InviteStatus.Pending)
            throw new NotFoundException("Invite", "token");

        if (invite.ExpiresAt <= DateTime.UtcNow)
            throw new NotFoundException("Invite", "token");

        // Reject if an account already exists for this email — existing-user flow
        // is out of scope for this release.
        var existingUser = await users.GetByEmailAsync(invite.Email, ct);
        if (existingUser is not null)
            throw new ConflictException(
                $"An account for {invite.Email} already exists. Please log in instead.");

        // Single-active-lease-per-property invariant: never materialize a second
        // active lease on an already-occupied property (a stale invite could
        // otherwise be accepted onto a property that's since been leased). Checked
        // before provisioning so we don't create an orphaned Keycloak account.
        if (await leases.HasActiveLeaseForPropertyAsync(invite.PropertyId, ct))
            throw new ConflictException("This property already has an active lease.");

        var keycloakSub = await provisioner.CreateAsync(new ProvisionUserRequest(
            Email: invite.Email,
            FirstName: cmd.FirstName,
            LastName: cmd.LastName,
            Phone: cmd.Phone,
            Password: cmd.Password,
            RealmRole: "Tenant"), ct);

        var user = new User
        {
            KeycloakSubId = keycloakSub,
            Email = invite.Email,
            FirstName = cmd.FirstName,
            LastName = cmd.LastName,
            Phone = cmd.Phone,
            AccountStatus = TenantAccountStatus.Active,
        };
        await users.AddAsync(user, ct);

        var lease = new Lease
        {
            LandlordId = invite.LandlordId,
            PropertyId = invite.PropertyId,
            TenantId = user.Id,
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

        // After commit: notify the landlord (SignalR + email) via the bus.
        // Property is eagerly loaded by GetByTokenHashAsync.
        await events.PublishAsync(
            new InviteAcceptedEvent(
                invite.Id,
                invite.LandlordId,
                invite.PropertyId,
                invite.Property!.Name,
                user.Id,
                $"{user.FirstName} {user.LastName}"),
            ct);

        return new InviteAcceptedDto(invite.Id, lease.Id);
    }
}
