using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;
using MyProperty.Infrastructure.Persistence.Repositories;
using MyProperty.Tests.Integration.Fixtures;

namespace MyProperty.Tests.Integration;

/// <summary>
/// Exercises <c>LandlordDashboardRepository.GetForLandlordAsync</c> directly
/// against a real Postgres instance. Each test seeds its own landlord GUID so
/// assertions can use exact equality without being affected by rows left behind
/// by other tests in the shared database.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class LandlordDashboardRepositoryTests(ApiFixture fixture)
{
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    private static User NewUser(Guid id) => new()
    {
        Id = id,
        KeycloakSubId = $"dashboard-repo-{id:N}",
        Email = $"dashboard-repo-{id:N}@test.local",
        FirstName = "Dashboard",
        LastName = "Repo",
    };

    private static Property NewProperty(Guid id, Guid landlordId) => new()
    {
        Id = id,
        LandlordId = landlordId,
        Name = $"Test Prop {id:N}",
        Address = "1 Test St",
    };

    private static Lease NewActiveLease(Guid id, Guid landlordId, Guid propertyId, Guid tenantId) => new()
    {
        Id = id,
        LandlordId = landlordId,
        PropertyId = propertyId,
        TenantId = tenantId,
        StartDate = Today,
        EndDate = Today.AddYears(1),
        MonthlyRent = 500m,
        Currency = "EUR",
    };

    private static Payment NewPayment(Guid leaseId, PaymentStatus status, DateOnly dueDate) => new()
    {
        Id = Guid.NewGuid(),
        LeaseId = leaseId,
        Amount = 500m,
        Currency = "EUR",
        DueDate = dueDate,
        Status = status,
    };

    [Fact]
    public async Task TotalProperties_counts_only_this_landlords_properties()
    {
        var landlordA = Guid.NewGuid();
        var landlordB = Guid.NewGuid();
        var propA1 = Guid.NewGuid();
        var propA2 = Guid.NewGuid();
        var propA3 = Guid.NewGuid();
        var propB1 = Guid.NewGuid();

        await fixture.WithDbAsync(async db =>
        {
            db.Users.AddRange(NewUser(landlordA), NewUser(landlordB));
            db.Properties.AddRange(
                NewProperty(propA1, landlordA),
                NewProperty(propA2, landlordA),
                NewProperty(propA3, landlordA),
                NewProperty(propB1, landlordB));
            await db.SaveChangesAsync();

            var repo = new LandlordDashboardRepository(db);
            var result = await repo.GetForLandlordAsync(landlordA, CancellationToken.None);

            Assert.Equal(3, result.TotalProperties);
        });
    }

    [Fact]
    public async Task ActiveLeases_excludes_terminated_leases()
    {
        var landlordId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        var activeLeaseId = Guid.NewGuid();
        var terminatedLeaseId = Guid.NewGuid();

        await fixture.WithDbAsync(async db =>
        {
            db.Users.AddRange(NewUser(landlordId), NewUser(tenantId));
            db.Properties.Add(NewProperty(propertyId, landlordId));

            var activeLease = NewActiveLease(activeLeaseId, landlordId, propertyId, tenantId);
            var terminatedLease = NewActiveLease(terminatedLeaseId, landlordId, propertyId, tenantId);
            terminatedLease.Terminate();

            db.Leases.AddRange(activeLease, terminatedLease);
            await db.SaveChangesAsync();

            var repo = new LandlordDashboardRepository(db);
            var result = await repo.GetForLandlordAsync(landlordId, CancellationToken.None);

            Assert.Equal(1, result.ActiveLeases);
        });
    }

    [Fact]
    public async Task ActiveTenants_is_distinct_across_active_leases()
    {
        var landlordId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var propA = Guid.NewGuid();
        var propB = Guid.NewGuid();
        var leaseA = Guid.NewGuid();
        var leaseB = Guid.NewGuid();

        await fixture.WithDbAsync(async db =>
        {
            db.Users.AddRange(NewUser(landlordId), NewUser(tenantId));
            db.Properties.AddRange(NewProperty(propA, landlordId), NewProperty(propB, landlordId));
            // Same tenant on two separate active leases.
            db.Leases.AddRange(
                NewActiveLease(leaseA, landlordId, propA, tenantId),
                NewActiveLease(leaseB, landlordId, propB, tenantId));
            await db.SaveChangesAsync();

            var repo = new LandlordDashboardRepository(db);
            var result = await repo.GetForLandlordAsync(landlordId, CancellationToken.None);

            Assert.Equal(2, result.ActiveLeases);
            Assert.Equal(1, result.ActiveTenants);
        });
    }

    [Fact]
    public async Task PendingPayments_counts_only_pending_status()
    {
        var landlordId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        var leaseId = Guid.NewGuid();

        await fixture.WithDbAsync(async db =>
        {
            db.Users.AddRange(NewUser(landlordId), NewUser(tenantId));
            db.Properties.Add(NewProperty(propertyId, landlordId));
            db.Leases.Add(NewActiveLease(leaseId, landlordId, propertyId, tenantId));
            db.Payments.AddRange(
                NewPayment(leaseId, PaymentStatus.Pending, Today.AddDays(-1)),
                NewPayment(leaseId, PaymentStatus.Outstanding, Today.AddDays(-1)),
                NewPayment(leaseId, PaymentStatus.Confirmed, Today.AddDays(-1)));
            await db.SaveChangesAsync();

            var repo = new LandlordDashboardRepository(db);
            var result = await repo.GetForLandlordAsync(landlordId, CancellationToken.None);

            Assert.Equal(1, result.PendingPayments);
        });
    }

    [Fact]
    public async Task OverduePayments_requires_outstanding_status_and_past_due_date()
    {
        var landlordId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        var leaseId = Guid.NewGuid();

        await fixture.WithDbAsync(async db =>
        {
            db.Users.AddRange(NewUser(landlordId), NewUser(tenantId));
            db.Properties.Add(NewProperty(propertyId, landlordId));
            db.Leases.Add(NewActiveLease(leaseId, landlordId, propertyId, tenantId));
            db.Payments.AddRange(
                // Outstanding + past → overdue
                NewPayment(leaseId, PaymentStatus.Outstanding, Today.AddDays(-1)),
                // Outstanding + future → not overdue
                NewPayment(leaseId, PaymentStatus.Outstanding, Today.AddDays(7)),
                // Pending + past → not overdue (wrong status)
                NewPayment(leaseId, PaymentStatus.Pending, Today.AddDays(-1)));
            await db.SaveChangesAsync();

            var repo = new LandlordDashboardRepository(db);
            var result = await repo.GetForLandlordAsync(landlordId, CancellationToken.None);

            Assert.Equal(1, result.OverduePayments);
        });
    }
}
