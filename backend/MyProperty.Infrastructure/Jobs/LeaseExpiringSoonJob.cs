using Hangfire;
using Microsoft.Extensions.Logging;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Notifications;

namespace MyProperty.Infrastructure.Jobs;

/// <summary>
/// Recurring daily job that pushes <c>LeaseExpiringSoon</c> SignalR notifications
/// to tenants whose active lease ends within <see cref="DaysThreshold"/> days.
/// </summary>
/// <remarks>
/// <c>[AutomaticRetry(Attempts = 0)]</c> — a missed push is inconsequential; the
/// next scheduled run will re-send. Retrying would double-notify tenants for no gain.
/// </remarks>
[AutomaticRetry(Attempts = 0)]
public sealed class LeaseExpiringSoonJob(
    ILeaseRepository leases,
    INotificationDispatcher dispatcher,
    ILogger<LeaseExpiringSoonJob> logger)
{
    private const int DaysThreshold = 30;

    public async Task ExecuteAsync(CancellationToken ct)
    {
        var expiring = await leases.ListAllExpiringSoonAsync(DaysThreshold, ct);
        if (expiring.Count == 0)
        {
            logger.LogInformation(
                "LeaseExpiringSoon: no active leases expiring within {Days} days.", DaysThreshold);
            return;
        }

        foreach (var lease in expiring)
        {
            var payload = new LeaseExpiringNotification(lease.Id, lease.EndDate);
            await dispatcher.NotifyTenantLeaseExpiringAsync(lease.TenantId, payload, ct);
        }

        logger.LogInformation(
            "LeaseExpiringSoon: pushed notifications for {Count} lease(s) expiring within {Days} days.",
            expiring.Count, DaysThreshold);
    }
}