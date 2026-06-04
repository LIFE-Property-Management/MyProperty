using Hangfire;
using Microsoft.Extensions.Logging;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Domain.Enums;

namespace MyProperty.Infrastructure.Jobs;

/// <summary>
/// Recurring (hourly) job that marks <c>Pending</c> invites past their
/// <c>ExpiresAt</c> as <c>Expired</c>.
/// </summary>
/// <remarks>
/// This is an UPDATE, so it deliberately goes through the change tracker +
/// <c>SaveChangesAsync</c> rather than <c>ExecuteUpdateAsync</c> — the latter
/// would bypass the auditing interceptor and leave <c>UpdatedAt</c> stale.
/// </remarks>
[AutomaticRetry(Attempts = 0)]
public sealed class MarkExpiredInvitesJob(
    IInviteRepository invites,
    ILogger<MarkExpiredInvitesJob> logger)
{
    public async Task ExecuteAsync(CancellationToken ct)
    {
        var expired = await invites.GetPendingExpiredAsOfAsync(DateTime.UtcNow, ct);
        if (expired.Count == 0)
        {
            logger.LogInformation("MarkExpiredInvites: no pending invites past expiry.");
            return;
        }

        foreach (var invite in expired)
            invite.Status = InviteStatus.Expired;

        await invites.SaveChangesAsync(ct);

        logger.LogInformation("MarkExpiredInvites: marked {Count} invite(s) as Expired.", expired.Count);
    }
}
