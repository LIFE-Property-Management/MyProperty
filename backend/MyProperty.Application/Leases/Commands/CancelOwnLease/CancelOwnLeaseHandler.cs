using MyProperty.Application.Common.Email;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Domain.Entities;

namespace MyProperty.Application.Leases.Commands.CancelOwnLease;

/// <summary>
/// Immediate self-service lease cancellation by a tenant (decision D2). Loads the
/// caller's own active lease, terminates it (<see cref="Lease.Terminate"/>), and
/// notifies the landlord by email. Notice period / penalty / deposit are deferred.
/// </summary>
public sealed class CancelOwnLeaseHandler(
    ILeaseRepository leases,
    ICurrentUserContext currentUserContext,
    IBackgroundJobQueue jobs,
    ILandlordDashboardCache dashboardCache)
{
    public async Task Handle(CancelOwnLeaseCommand cmd, CancellationToken ct)
    {
        var tenant = await currentUserContext.GetOrSyncUserAsync(ct);

        var lease = await leases.GetActiveByTenantIdAsync(tenant.Id, ct)
            ?? throw new NotFoundException("Lease", tenant.Id);

        lease.Terminate();
        await leases.SaveChangesAsync(ct);

        // GetActiveByTenantIdAsync includes Property and Landlord.
        jobs.EnqueueEmail(BuildCancelledEmail(lease, tenant));

        await dashboardCache.InvalidateAsync(lease.LandlordId, ct);
    }

    private static EmailMessage BuildCancelledEmail(Lease lease, User tenant)
    {
        var landlord = lease.Landlord!;
        var tenantName = $"{tenant.FirstName} {tenant.LastName}";
        var body = $"""
            <p>Hi {landlord.FirstName},</p>
            <p><strong>{tenantName}</strong> has cancelled their lease for
            <strong>{lease.Property!.Name}</strong>, effective immediately.</p>
            <p>The property is now vacant and available to re-let from your landlord portal.</p>
            """;

        return new EmailMessage(
            To: landlord.Email,
            Subject: $"{tenantName} cancelled their lease for {lease.Property!.Name}",
            Body: body,
            IsHtml: true);
    }
}
