using System.Security.Cryptography;
using System.Text;
using FluentValidation;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;
using MyProperty.Domain.Enums;

namespace MyProperty.Application.Invites.Commands.RejectInvite;

public sealed class RejectInviteHandler(
    IValidator<RejectInviteCommand> validator,
    IInviteRepository invites)
{
    public async Task Handle(RejectInviteCommand cmd, CancellationToken ct)
    {
        await validator.EnsureValidAsync(cmd, ct);

        var tokenHash = HashToken(cmd.Token);

        var invite = await invites.GetByTokenHashAsync(tokenHash, ct)
            ?? throw new NotFoundException("Invite", "token");

        if (invite.Status != InviteStatus.Pending)
            throw new NotFoundException("Invite", "token");

        if (invite.ExpiresAt <= DateTime.UtcNow)
            throw new NotFoundException("Invite", "token");

        invite.Status = InviteStatus.Rejected;
        invite.RejectedAt = DateTime.UtcNow;

        await invites.SaveChangesAsync(ct);
    }

    private static string HashToken(string plainToken)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(plainToken)))
            .ToLowerInvariant();
}
