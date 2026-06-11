using MyProperty.Domain.Entities;
using MyProperty.Infrastructure.Persistence;
using MyProperty.Infrastructure.Persistence.Repositories;
using MyProperty.Tests.Integration.Fixtures;

namespace MyProperty.Tests.Integration;

/// <summary>
/// Exercises <c>LeaseRepository.ListAllExpiringSoonAsync</c> — the query that backs the
/// recurring <c>LeaseExpiringSoonJob</c> — against real Postgres: the Active-only filter, the
/// inclusive [today, today + threshold] window (both bounds), and the global soft-delete query
/// filter. Assertions key off the specific seeded ids so they stay robust to rows other tests
/// leave behind (the query is system-wide).
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class LeaseExpiringSoonRepositoryTests(ApiFixture fixture)
{
    private static readonly Guid LandlordId = new("55555555-5555-5555-5555-eeeeeeeeeeee");
    private static readonly Guid TenantId = new("66666666-6666-6666-6666-ffffffffffff");

    private static async Task EnsureParentsAsync(AppDbContext db)
    {
        if (await db.Users.FindAsync(LandlordId) is null)
            db.Users.Add(new User
            {
                Id = LandlordId,
                KeycloakSubId = "synthetic-landlord-expiring-tests",
                Email = "synthetic-expiring-landlord@test.local",
                FirstName = "Synth",
                LastName = "Landlord",
            });

        if (await db.Users.FindAsync(TenantId) is null)
            db.Users.Add(new User
            {
                Id = TenantId,
                KeycloakSubId = "synthetic-tenant-expiring-tests",
                Email = "synthetic-expiring-tenant@test.local",
                FirstName = "Synth",
                LastName = "Tenant",
            });
    }

    // Each lease gets its own property: the single-active-lease-per-property
    // unique index forbids stacking multiple Active leases on one property, which
    // is irrelevant to what this test exercises (the Active-only + date-window filter).
    private static (Property Property, Lease Lease) NewLeaseOnOwnProperty(DateOnly endDate)
    {
        var propertyId = Guid.NewGuid();
        var property = new Property
        {
            Id = propertyId,
            LandlordId = LandlordId,
            Name = "Expiring Property",
            Address = "1 Expiry Way",
        };
        var lease = new Lease
        {
            Id = Guid.NewGuid(),
            LandlordId = LandlordId,
            PropertyId = propertyId,
            TenantId = TenantId,
            StartDate = endDate.AddYears(-1),
            EndDate = endDate,
            MonthlyRent = 800m,
            Currency = "EUR",
        };
        return (property, lease);
    }

    [Fact]
    public async Task ListAllExpiringSoon_returns_only_active_leases_inside_the_window()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var (soonProp, soon) = NewLeaseOnOwnProperty(today.AddDays(10));            // Active, in window      → included
        var (farFutureProp, farFuture) = NewLeaseOnOwnProperty(today.AddDays(60));  // Active, beyond 30 days → excluded
        var (pastEndProp, pastEnd) = NewLeaseOnOwnProperty(today.AddDays(-5));       // Active, already ended  → excluded (lower bound)
        var (terminatedProp, terminated) = NewLeaseOnOwnProperty(today.AddDays(10)); // Terminated             → excluded
        terminated.Terminate();
        var (softDeletedProp, softDeleted) = NewLeaseOnOwnProperty(today.AddDays(10)); // Active but soft-deleted → excluded
        softDeleted.DeletedAt = DateTime.UtcNow;

        await fixture.WithDbAsync(async db =>
        {
            await EnsureParentsAsync(db);
            db.Properties.AddRange(soonProp, farFutureProp, pastEndProp, terminatedProp, softDeletedProp);
            db.Leases.AddRange(soon, farFuture, pastEnd, terminated, softDeleted);
            await db.SaveChangesAsync();

            var repo = new LeaseRepository(db);
            var result = await repo.ListAllExpiringSoonAsync(today, 30, CancellationToken.None);

            var ids = result.Select(l => l.Id).ToHashSet();
            Assert.Contains(soon.Id, ids);              // Active + within [today, +30] → included
            Assert.DoesNotContain(farFuture.Id, ids);   // beyond the threshold
            Assert.DoesNotContain(pastEnd.Id, ids);     // before today (validates the lower bound)
            Assert.DoesNotContain(terminated.Id, ids);  // not Active
            Assert.DoesNotContain(softDeleted.Id, ids); // soft-deleted (global query filter)

            // The job builds emails from these navigations — confirm the query eager-loads them.
            var loaded = result.Single(l => l.Id == soon.Id);
            Assert.NotNull(loaded.Tenant);
            Assert.NotNull(loaded.Landlord);
            Assert.NotNull(loaded.Property);
        });
    }
}
