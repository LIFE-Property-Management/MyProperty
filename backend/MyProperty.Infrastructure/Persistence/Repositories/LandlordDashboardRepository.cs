using Microsoft.EntityFrameworkCore;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Landlord.Queries.GetLandlordDashboard;
using MyProperty.Domain.Enums;

namespace MyProperty.Infrastructure.Persistence.Repositories;

internal sealed class LandlordDashboardRepository(AppDbContext db) : ILandlordDashboardRepository
{
    public async Task<LandlordDashboardDto> GetForLandlordAsync(Guid landlordId, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // EF cannot share a DbContext across concurrent queries, so the
        // counters are run sequentially. Each is index-backed (see M3.4):
        //   - properties.LandlordId         → IX_properties_LandlordId
        //   - leases.(LandlordId, Status)   → IX_leases_LandlordId_Status
        //   - payments.(LeaseId, Status)    → IX_payments_LeaseId_Status
        //   - payments.DueDate (partial)    → IX_payments_DueDate_Outstanding

        var totalProperties = await db.Properties
            .CountAsync(p => p.LandlordId == landlordId, ct);

        var activeLeases = await db.Leases
            .CountAsync(l => l.LandlordId == landlordId && l.Status == LeaseStatus.Active, ct);

        var activeTenants = await db.Leases
            .Where(l => l.LandlordId == landlordId && l.Status == LeaseStatus.Active)
            .Select(l => l.TenantId)
            .Distinct()
            .CountAsync(ct);

        var pendingPayments = await db.Payments
            .CountAsync(p => p.Lease!.LandlordId == landlordId
                          && p.Status == PaymentStatus.Pending, ct);

        var overduePayments = await db.Payments
            .CountAsync(p => p.Lease!.LandlordId == landlordId
                          && p.Status == PaymentStatus.Outstanding
                          && p.DueDate < today, ct);

        return new LandlordDashboardDto(
            TotalProperties: totalProperties,
            ActiveLeases: activeLeases,
            ActiveTenants: activeTenants,
            PendingPayments: pendingPayments,
            OverduePayments: overduePayments,
            GeneratedAt: DateTime.UtcNow);
    }
}
