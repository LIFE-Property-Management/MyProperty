using Hangfire;
using Microsoft.Extensions.Logging;
using MyProperty.Application.Common.Interfaces;

namespace MyProperty.Infrastructure.Jobs;

/// <summary>
/// Recurring (daily, 03:00 UTC) job that hard-deletes <c>Expired</c> invites
/// older than 30 days. An <c>Accepted</c> invite is the one that produced a
/// lease, so <c>Status == Expired</c> already implies "no resulting lease" —
/// these orphans have no business records to preserve, hence a true purge.
/// </summary>
/// <remarks>
/// Uses the repository's set-based <c>ExecuteDeleteAsync</c> (one SQL DELETE,
/// no change tracker), which deliberately bypasses the auditing interceptor —
/// correct for a hard delete.
/// </remarks>
[AutomaticRetry(Attempts = 0)]
public sealed class OrphanCleanupJob(
    IInviteRepository invites,
    ILogger<OrphanCleanupJob> logger)
{
    private const int RetentionDays = 30;

    public async Task ExecuteAsync(CancellationToken ct)
    {
        var cutoffUtc = DateTime.UtcNow.AddDays(-RetentionDays);
        var deleted = await invites.DeleteExpiredOlderThanAsync(cutoffUtc, ct);

        logger.LogInformation(
            "OrphanCleanup: hard-deleted {Count} expired invite(s) older than {RetentionDays} days.",
            deleted, RetentionDays);
    }
}
