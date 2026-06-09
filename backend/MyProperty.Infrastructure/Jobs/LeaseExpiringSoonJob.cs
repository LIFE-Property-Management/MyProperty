using Hangfire;
using Microsoft.Extensions.Logging;
using MyProperty.Application.Common.Email;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Notifications;
using MyProperty.Domain.Entities;

namespace MyProperty.Infrastructure.Jobs;

/// <summary>
/// Recurring daily job that alerts both the tenant and the landlord when an active
/// lease is approaching its end date. Delivery is a durable email (the authoritative
/// channel, via <see cref="IBackgroundJobQueue"/> → SendEmailJob) plus a best-effort
/// SignalR push to each party. To avoid notifying every day for a month, a lease is
/// only flagged on the day-marks in <see cref="NotifyOnDaysBefore"/>.
/// </summary>
/// <remarks>
/// <c>[AutomaticRetry(Attempts = 0)]</c> — each lease is handled inside its own
/// try/catch (failures are logged and skipped), so a single bad row never aborts the
/// batch, and a whole-job retry would re-notify everyone already handled this run.
/// The tenant and landlord emails are enqueued independently (see <see cref="TryEnqueue"/>)
/// so a failure on one never suppresses the other.
/// </remarks>
[AutomaticRetry(Attempts = 0)]
public sealed class LeaseExpiringSoonJob(
    ILeaseRepository leases,
    IBackgroundJobQueue jobs,
    INotificationDispatcher dispatcher,
    TimeProvider clock,
    ILogger<LeaseExpiringSoonJob> logger)
{
    private const int DaysThreshold = 30;

    // Flag a lease only at these day-marks before EndDate, so each lease is notified a
    // handful of times rather than once a day for a month. All values must be <= DaysThreshold.
    private static readonly int[] NotifyOnDaysBefore = [30, 14, 7, 3, 1];

    public async Task ExecuteAsync(CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        var expiring = await leases.ListAllExpiringSoonAsync(today, DaysThreshold, ct);

        int notified = 0, skipped = 0, failed = 0;

        foreach (var lease in expiring)
        {
            var daysUntil = lease.EndDate.DayNumber - today.DayNumber;
            if (Array.IndexOf(NotifyOnDaysBefore, daysUntil) < 0)
            {
                skipped++;
                continue;
            }

            var tenant = lease.Tenant;
            var landlord = lease.Landlord;
            var property = lease.Property;
            if (tenant is null || landlord is null || property is null)
            {
                logger.LogWarning(
                    "LeaseExpiringSoon: lease {LeaseId} is missing Tenant/Landlord/Property navigation; skipping.",
                    lease.Id);
                skipped++;
                continue;
            }

            try
            {
                // Each party's email is enqueued independently: a failure to enqueue one
                // must never suppress the other (the two are separate durable deliveries).
                var tenantQueued = TryEnqueue(BuildTenantEmail(tenant, property, lease.EndDate), lease.Id);
                var landlordQueued = TryEnqueue(BuildLandlordEmail(landlord, tenant, property, lease.EndDate), lease.Id);

                // Best-effort SignalR signal to each party. SignalRNotificationDispatcher
                // catches and logs transport errors, so these never throw and a flaky
                // backplane cannot affect the durable email path above.
                var payload = new LeaseExpiringNotification(
                    lease.Id, lease.PropertyId, lease.TenantId, lease.EndDate);
                await dispatcher.NotifyTenantLeaseExpiringAsync(lease.TenantId, payload, ct);
                await dispatcher.NotifyLandlordLeaseExpiringAsync(lease.LandlordId, payload, ct);

                if (tenantQueued && landlordQueued)
                    notified++;
                else
                    failed++;
            }
            catch (Exception ex)
            {
                failed++;
                logger.LogError(ex,
                    "LeaseExpiringSoon: unexpected failure handling lease {LeaseId}; continuing with the rest.",
                    lease.Id);
            }
        }

        logger.LogInformation(
            "LeaseExpiringSoon: {Notified} lease(s) notified, {Skipped} skipped, {Failed} failed (scan window {Days} days).",
            notified, skipped, failed, DaysThreshold);
    }

    private bool TryEnqueue(EmailMessage email, Guid leaseId)
    {
        try
        {
            jobs.EnqueueEmail(email);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "LeaseExpiringSoon: failed to enqueue an expiry email for lease {LeaseId}; continuing.",
                leaseId);
            return false;
        }
    }

    private static EmailMessage BuildTenantEmail(User tenant, Property property, DateOnly endDate)
    {
        var body = $"""
            <p>Hi {tenant.FirstName},</p>
            <p>Your lease for <strong>{property.Name}</strong> at {property.Address}
            ends on <strong>{endDate:yyyy-MM-dd}</strong>.</p>
            <p>If you'd like to renew or arrange to move out, please get in touch with your landlord.</p>
            """;
        return new EmailMessage(
            To: tenant.Email,
            Subject: $"Your lease at {property.Name} expires on {endDate:yyyy-MM-dd}",
            Body: body,
            IsHtml: true);
    }

    private static EmailMessage BuildLandlordEmail(User landlord, User tenant, Property property, DateOnly endDate)
    {
        var body = $"""
            <p>Hi {landlord.FirstName},</p>
            <p>The lease for <strong>{property.Name}</strong> ({property.Address}), held by
            {tenant.FirstName} {tenant.LastName}, ends on <strong>{endDate:yyyy-MM-dd}</strong>.</p>
            <p>Reach out to your tenant if you'd like to arrange a renewal.</p>
            """;
        return new EmailMessage(
            To: landlord.Email,
            Subject: $"Lease expiring soon: {property.Name} ({endDate:yyyy-MM-dd})",
            Body: body,
            IsHtml: true);
    }
}
