using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using MyProperty.Application.Stats.Queries.GetPublicStats;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;
using MyProperty.Tests.Integration.Fixtures;

namespace MyProperty.Tests.Integration;

/// <summary>
/// Exercises <c>GET /api/v1/stats/public</c>: anonymous access, the
/// most-used-currency confirmed-rent aggregation (rent is never summed across
/// currencies), and the soft-delete / distinct-landlord counters.
///
/// The integration DB is shared across the collection and tests run
/// sequentially, so absolute totals are never asserted. Currency semantics are
/// proven by seeding a currency unique to this class and forcing it to be the
/// global confirmed-payment-count leader; the counters are proven via
/// before/after deltas around a known seed.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class PublicStatsTests(ApiFixture fixture)
{
    private const string UniqueCurrency = "PZX"; // used only by this test class

    private static async Task<PublicStatsDto> GetStatsAsync(HttpClient client)
    {
        var resp = await client.GetAsync("/api/v1/stats/public");
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var dto = await resp.Content.ReadFromJsonAsync<PublicStatsDto>();
        Assert.NotNull(dto);
        return dto!;
    }

    [Fact]
    public async Task Public_stats_is_anonymous_and_reports_most_used_currency_confirmed_total()
    {
        // No Authorization header — the endpoint is [AllowAnonymous].
        var client = fixture.CreateClient();

        // Make UniqueCurrency the global confirmed-count leader deterministically:
        // seed strictly more confirmed payments in it than any other currency has.
        var currentMaxConfirmed = await fixture.WithDbAsync(db => db.Payments
            .Where(p => p.Status == PaymentStatus.Confirmed)
            .GroupBy(p => p.Currency)
            .Select(g => g.Count())
            .OrderByDescending(c => c)
            .FirstOrDefaultAsync());

        var confirmedCount = currentMaxConfirmed + 2;
        const decimal perPayment = 100m;
        var expectedTotal = confirmedCount * perPayment;

        await fixture.WithDbAsync(async db =>
        {
            var landlordId = Guid.NewGuid();
            var propertyId = Guid.NewGuid();
            var leaseId = Guid.NewGuid();

            db.Users.Add(new User
            {
                Id = landlordId,
                KeycloakSubId = $"pub-ll-{Guid.NewGuid():N}",
                Email = $"pub-ll-{Guid.NewGuid():N}@test.local",
                FirstName = "Pub",
                LastName = "Landlord",
            });
            var tenant = new User
            {
                Id = Guid.NewGuid(),
                KeycloakSubId = $"pub-tn-{Guid.NewGuid():N}",
                Email = $"pub-tn-{Guid.NewGuid():N}@test.local",
                FirstName = "Pub",
                LastName = "Tenant",
            };
            db.Users.Add(tenant);
            db.Properties.Add(new Property
            {
                Id = propertyId,
                LandlordId = landlordId,
                Name = "Pub Apt",
                Address = "1 Pub St",
            });
            db.Leases.Add(new Lease
            {
                Id = leaseId,
                LandlordId = landlordId,
                PropertyId = propertyId,
                TenantId = tenant.Id,
                StartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date),
                EndDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
                MonthlyRent = perPayment,
                Currency = UniqueCurrency,
            });

            for (var i = 0; i < confirmedCount; i++)
            {
                db.Payments.Add(new Payment
                {
                    Id = Guid.NewGuid(),
                    LeaseId = leaseId,
                    Amount = perPayment,
                    Currency = UniqueCurrency,
                    DueDate = DateOnly.FromDateTime(DateTime.UtcNow.Date),
                    Status = PaymentStatus.Confirmed,
                });
            }
            // Non-confirmed payments in the same currency must NOT count toward
            // the total — proves the confirmed-only filter.
            db.Payments.Add(new Payment
            {
                Id = Guid.NewGuid(),
                LeaseId = leaseId,
                Amount = 9999m,
                Currency = UniqueCurrency,
                DueDate = DateOnly.FromDateTime(DateTime.UtcNow.Date),
                Status = PaymentStatus.Pending,
            });
            db.Payments.Add(new Payment
            {
                Id = Guid.NewGuid(),
                LeaseId = leaseId,
                Amount = 8888m,
                Currency = UniqueCurrency,
                DueDate = DateOnly.FromDateTime(DateTime.UtcNow.Date),
                Status = PaymentStatus.Rejected,
            });

            await db.SaveChangesAsync();
        });

        var dto = await GetStatsAsync(client);

        // Dominant currency is reported, and its total is the confirmed-only sum
        // for that currency alone (never blended with other currencies).
        Assert.Equal(UniqueCurrency, dto.Currency);
        Assert.Equal(expectedTotal, dto.RentCollected);
    }

    [Fact]
    public async Task Public_stats_excludes_soft_deleted_properties_and_counts_distinct_landlords()
    {
        var client = fixture.CreateClient();
        var before = await GetStatsAsync(client);

        var landlordA = Guid.NewGuid();
        var landlordB = Guid.NewGuid();

        await fixture.WithDbAsync(async db =>
        {
            db.Users.Add(new User
            {
                Id = landlordA,
                KeycloakSubId = $"pub-a-{Guid.NewGuid():N}",
                Email = $"pub-a-{Guid.NewGuid():N}@test.local",
                FirstName = "A",
                LastName = "LL",
            });
            db.Users.Add(new User
            {
                Id = landlordB,
                KeycloakSubId = $"pub-b-{Guid.NewGuid():N}",
                Email = $"pub-b-{Guid.NewGuid():N}@test.local",
                FirstName = "B",
                LastName = "LL",
            });

            // landlordA: two ACTIVE properties → distinct landlords +1, properties +2.
            db.Properties.Add(new Property { Id = Guid.NewGuid(), LandlordId = landlordA, Name = "A1", Address = "A1 St" });
            db.Properties.Add(new Property { Id = Guid.NewGuid(), LandlordId = landlordA, Name = "A2", Address = "A2 St" });
            // landlordB: a single SOFT-DELETED property → excluded by the global
            // query filter, so it contributes neither a property nor a landlord.
            db.Properties.Add(new Property
            {
                Id = Guid.NewGuid(),
                LandlordId = landlordB,
                Name = "B1",
                Address = "B1 St",
                DeletedAt = DateTime.UtcNow,
            });

            await db.SaveChangesAsync();
        });

        var after = await GetStatsAsync(client);

        Assert.Equal(before.PropertiesManaged + 2, after.PropertiesManaged);
        Assert.Equal(before.LandlordsOnboarded + 1, after.LandlordsOnboarded);
    }
}
