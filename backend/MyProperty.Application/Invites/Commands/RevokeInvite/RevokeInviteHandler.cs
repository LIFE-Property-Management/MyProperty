using FluentValidation;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;
using MyProperty.Domain.Enums;

namespace MyProperty.Application.Invites.Commands.RevokeInvite;

/// <summary>
/// Landlord-initiated cancellation of an invite. Verifies the caller owns the
/// invite (else 403) and that it is still cancellable — only <c>Pending</c> or
/// naturally <c>Expired</c> invites can be revoked; an already Accepted/Rejected
/// (or Revoked) invite is a 409. No event is published — revoke is the landlord's
/// own action, so there is no one to notify.
/// </summary>
public sealed class RevokeInviteHandler(
    IValidator<RevokeInviteCommand> validator,
    IInviteRepository invites,
    ICurrentUserContext currentUserContext)
{
    public async Task Handle(RevokeInviteCommand cmd, CancellationToken ct)
    {
        await validator.EnsureValidAsync(cmd, ct);

        var landlord = await currentUserContext.GetOrSyncUserAsync(ct);

        var invite = await invites.GetByIdAsync(cmd.InviteId, ct)
            ?? throw new NotFoundException("Invite", cmd.InviteId);

        if (invite.LandlordId != landlord.Id)
            throw new ForbiddenException("Invite does not belong to current landlord.");

        if (invite.Status is not (InviteStatus.Pending or InviteStatus.Expired))
            throw new ConflictException(
                $"Only pending or expired invites can be revoked; this invite is {invite.Status}.");

        invite.Status = InviteStatus.Revoked;

        await invites.SaveChangesAsync(ct);
    }
}
