using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using MyProperty.Application.Landlord.Queries.GetLandlordDashboard;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;
using MyProperty.Tests.Integration.Fixtures;

namespace MyProperty.Tests.Integration;

/// <summary>
/// Exercises the cache-aside flow on <c>GET /api/v1/landlord/dashboard</c>:
/// first request misses (DB query, populate cache), second hits (DB query
/// skipped). Cache is the in-memory <see cref="Microsoft.Extensions.Caching.Distributed.IDistributedCache"/>
/// substitute — same interface as production Redis, so the cache code path is
/// identical.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class LandlordDashboardTests(ApiFixture fixture)
{
    [Fact]
    public async Task Dashboard_returns_aggregate_counters_for_landlord()
    {
        var client = await fixture.CreateAuthenticatedClientAsync(ApiFixture.LandlordEmail);
        await client.GetAsync("/api/v1/me"); // upsert User row
        var landlordId = await fixture.WithDbAsync(async db =>
            (await db.Users.FirstAsync(u => u.Email == ApiFixture.LandlordEmail)).Id);

        // Seed two properties + one active lease + one outstanding payment.
        var propertyA = Guid.NewGuid();
        var propertyB = Guid.NewGuid();
        var leaseId = Guid.NewGuid();
        var paymentId = Guid.NewGuid();

        await fixture.WithDbAsync(async db =>
        {
            var tenant = new User
            {
                Id = Guid.NewGuid(),
                KeycloakSubId = $"dashboard-tenant-{Guid.NewGuid():N}",
                Email = $"dashboard-tenant-{Guid.NewGuid():N}@test.local",
                FirstName = "Dashboard",
                LastName = "Tenant",
            };
            db.Users.Add(tenant);
            db.Properties.Add(new Property
            {
                Id = propertyA,
                LandlordId = landlordId,
                Name = "Dashboard Apt A",
                Address = "1 Apt A",
            });
            db.Properties.Add(new Property
            {
                Id = propertyB,
                LandlordId = landlordId,
                Name = "Dashboard Apt B",
                Address = "2 Apt B",
            });
            db.Leases.Add(new Lease
            {
                Id = leaseId,
                LandlordId = landlordId,
                PropertyId = propertyA,
                TenantId = tenant.Id,
                StartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date),
                EndDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
                MonthlyRent = 800m,
                Currency = "EUR"
            });
            db.Payments.Add(new Payment
            {
                Id = paymentId,
                LeaseId = leaseId,
                Amount = 800m,
                Currency = "EUR",
                DueDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(-5),
                Status = PaymentStatus.Outstanding,
            });
            await db.SaveChangesAsync();
        });

        // Eviction guarantees the next request is a cache miss regardless of
        // what previous tests in this collection put in the cache.
        await fixture.EvictDashboardCacheAsync(landlordId);

        var resp1 = await client.GetAsync("/api/v1/landlord/dashboard");
        Assert.Equal(HttpStatusCode.OK, resp1.StatusCode);
        var dto1 = await resp1.Content.ReadFromJsonAsync<LandlordDashboardDto>();
        Assert.NotNull(dto1);
        Assert.True(dto1!.TotalProperties >= 2,
            $"expected ≥ 2 properties owned by landlord, got {dto1.TotalProperties}");
        Assert.True(dto1.ActiveLeases >= 1);
        Assert.True(dto1.ActiveTenants >= 1);
        Assert.True(dto1.OverduePayments >= 1, "outstanding payment with past DueDate should count as overdue");

        // Second call: cache hit. Same payload, identical GeneratedAt timestamp
        // (proves it came from the cache, not a fresh DB read).
        var resp2 = await client.GetAsync("/api/v1/landlord/dashboard");
        Assert.Equal(HttpStatusCode.OK, resp2.StatusCode);
        var dto2 = await resp2.Content.ReadFromJsonAsync<LandlordDashboardDto>();
        Assert.NotNull(dto2);
        Assert.Equal(dto1.GeneratedAt, dto2!.GeneratedAt);
    }
}
