using FluentValidation;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Options;
using MyProperty.Application.Common.Validation;
using MyProperty.Domain.Enums;

namespace MyProperty.Application.Invites.Commands.ResendInvite;

/// <summary>
/// Re-issues a landlord's Pending or Expired invite. Verifies ownership (else
/// 403) and cancellable status (Accepted/Rejected/Revoked → 409). A brand-new
/// token is generated and hashed via <see cref="InviteTokenFactory"/> — so the
/// previously-mailed link no longer resolves — the expiry window is reset, the
/// invite is set back to Pending, and the invite email is re-enqueued through
/// <see cref="InviteEmailFactory"/>.
/// </summary>
public sealed class ResendInviteHandler(
    IValidator<ResendInviteCommand> validator,
    IInviteRepository invites,
    IBackgroundJobQueue jobs,
    ICurrentUserContext currentUserContext,
    IOptions<InviteOptions> options,
    ILogger<ResendInviteHandler> logger)
{
    public async Task<InviteResentDto> Handle(ResendInviteCommand cmd, CancellationToken ct)
    {
        await validator.EnsureValidAsync(cmd, ct);

        var landlord = await currentUserContext.GetOrSyncUserAsync(ct);

        var invite = await invites.GetByIdAsync(cmd.InviteId, ct)
            ?? throw new NotFoundException("Invite", cmd.InviteId);

        if (invite.LandlordId != landlord.Id)
            throw new ForbiddenException("Invite does not belong to current landlord.");

        if (invite.Status is not (InviteStatus.Pending or InviteStatus.Expired))
            throw new ConflictException(
                $"Only pending or expired invites can be resent; this invite is {invite.Status}.");

        var token = InviteTokenFactory.Issue();

        invite.TokenHash = token.TokenHash;
        invite.ExpiresAt = DateTime.UtcNow.AddDays(options.Value.ExpiryDays);
        invite.Status = InviteStatus.Pending;

        await invites.SaveChangesAsync(ct);

        logger.LogInformation("Invite {InviteId} resent to {Email}", invite.Id, invite.Email);

        // Property + Landlord are eagerly loaded by GetByIdAsync.
        jobs.EnqueueEmail(InviteEmailFactory.Build(
            invite, invite.Property!, invite.Landlord!, token.PlainToken, options.Value.PortalBaseUrl));

        return new InviteResentDto(invite.Id, invite.ExpiresAt);
    }
}
