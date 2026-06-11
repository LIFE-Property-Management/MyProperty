using FluentValidation;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Messaging;
using MyProperty.Application.Common.Validation;
using MyProperty.Application.Invites.Events;
using MyProperty.Domain.Enums;

namespace MyProperty.Application.Invites.Commands.RejectInvite;

public sealed class RejectInviteHandler(
    IValidator<RejectInviteCommand> validator,
    IInviteRepository invites,
    IEventPublisher events)
{
    public async Task Handle(RejectInviteCommand cmd, CancellationToken ct)
    {
        await validator.EnsureValidAsync(cmd, ct);

        var tokenHash = InviteTokenHasher.Hash(cmd.Token);

        var invite = await invites.GetByTokenHashAsync(tokenHash, ct)
            ?? throw new NotFoundException("Invite", "token");

        if (invite.Status != InviteStatus.Pending)
            throw new NotFoundException("Invite", "token");

        if (invite.ExpiresAt <= DateTime.UtcNow)
            throw new NotFoundException("Invite", "token");

        invite.Status = InviteStatus.Rejected;
        invite.RejectedAt = DateTime.UtcNow;

        await invites.SaveChangesAsync(ct);

        // After commit: push a SignalR signal to the landlord (no email leg).
        // Property is eagerly loaded by GetByTokenHashAsync.
        await events.PublishAsync(
            new InviteRejectedEvent(
                invite.Id,
                invite.LandlordId,
                invite.PropertyId,
                invite.Property!.Name),
            ct);
    }
}
