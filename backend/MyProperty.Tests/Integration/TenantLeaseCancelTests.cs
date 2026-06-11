using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using MyProperty.Application.Leases.Queries.GetTenantLease;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;
using MyProperty.Tests.Integration.Fixtures;

namespace MyProperty.Tests.Integration;

/// <summary>
/// Tenant lease surface (Plan 3 / D5 + D2): the own-lease read and immediate
/// self-service cancellation live under <c>/api/v1/tenant</c>. Cancelling
/// terminates the lease and emails the landlord (captured by the recording
/// queue). Uses <see cref="ApiFixture.ImposterEmail"/> — a seeded tenant that no
/// other integration test leases, so <c>GetActiveByTenantIdAsync</c> is
/// deterministic against the shared database.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class TenantLeaseCancelTests(ApiFixture fixture)
{
    [Fact]
    public async Task Tenant_cancels_active_lease_terminates_it_and_emails_landlord()
    {
        var landlordClient = await fixture.CreateAuthenticatedClientAsync(ApiFixture.LandlordEmail);
        await landlordClient.GetAsync("/api/v1/me");
        var landlordId = await fixture.WithDbAsync(async db =>
            (await db.Users.FirstAsync(u => u.Email == ApiFixture.LandlordEmail)).Id);

        var tenantClient = await fixture.CreateAuthenticatedClientAsync(ApiFixture.ImposterEmail);
        await tenantClient.GetAsync("/api/v1/me");
        var tenantId = await fixture.WithDbAsync(async db =>
            (await db.Users.FirstAsync(u => u.Email == ApiFixture.ImposterEmail)).Id);

        // Seed a property + active lease for the tenant.
        var propertyId = Guid.NewGuid();
        var leaseId = Guid.NewGuid();
        await fixture.WithDbAsync(async db =>
        {
            db.Properties.Add(new Property
            {
                Id = propertyId,
                LandlordId = landlordId,
                Name = "Cancel Test Apt",
                Address = "9 Leaving Ln",
            });
            db.Leases.Add(new Lease
            {
                Id = leaseId,
                LandlordId = landlordId,
                PropertyId = propertyId,
                TenantId = tenantId,
                StartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(-30),
                EndDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
                MonthlyRent = 1100m,
                Currency = "EUR",
            });
            await db.SaveChangesAsync();
        });

        // GET /tenant/lease returns the active lease (the moved route).
        var leaseResp = await tenantClient.GetAsync("/api/v1/tenant/lease");
        Assert.Equal(HttpStatusCode.OK, leaseResp.StatusCode);
        var leaseDto = await leaseResp.Content.ReadFromJsonAsync<TenantLeaseDto>(ApiFixture.JsonOptions);
        Assert.NotNull(leaseDto);
        Assert.Equal(leaseId, leaseDto!.Id);
        Assert.Equal("Cancel Test Apt", leaseDto.PropertyName);

        fixture.Queue.Clear();

        // POST /tenant/lease/cancel terminates the lease.
        var cancelResp = await tenantClient.PostAsync("/api/v1/tenant/lease/cancel", content: null);
        Assert.Equal(HttpStatusCode.NoContent, cancelResp.StatusCode);

        await fixture.WithDbAsync(async db =>
        {
            var lease = await db.Leases.FirstAsync(l => l.Id == leaseId);
            Assert.Equal(LeaseStatus.Terminated, lease.Status);
        });

        // The landlord was notified by email.
        var email = Assert.Single(fixture.Queue.Emails);
        Assert.Equal(ApiFixture.LandlordEmail, email.To);
        Assert.Contains("Cancel Test Apt", email.Subject);
        Assert.Contains("Cancel Test Apt", email.Body);
        Assert.True(email.IsHtml);

        // The tenant now has no active lease.
        var afterResp = await tenantClient.GetAsync("/api/v1/tenant/lease");
        Assert.Equal(HttpStatusCode.NoContent, afterResp.StatusCode);
    }

    [Fact]
    public async Task Cancel_returns_404_when_tenant_has_no_active_lease()
    {
        var tenantClient = await fixture.CreateAuthenticatedClientAsync(ApiFixture.TenantEmail);
        await tenantClient.GetAsync("/api/v1/me");

        // The shared DB may carry an active lease for this tenant from another
        // test; drain any so the no-active-lease 404 below is deterministic.
        await DrainActiveLeasesAsync(tenantClient);

        var resp = await tenantClient.PostAsync("/api/v1/tenant/lease/cancel", content: null);
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    private static async Task DrainActiveLeasesAsync(HttpClient tenantClient)
    {
        // Each cancel terminates the one lease GetActiveByTenantIdAsync returns, so
        // we loop. The "single active lease per tenant" invariant is still deferred
        // (see backend/CLAUDE.md), so a tenant *could* hold more than one active
        // lease; 5 is a generous safety bound — no test seeds anywhere near that
        // many for this tenant — that also guarantees the loop can't spin forever.
        for (var i = 0; i < 5; i++)
        {
            var leaseResp = await tenantClient.GetAsync("/api/v1/tenant/lease");
            if (leaseResp.StatusCode == HttpStatusCode.NoContent)
                return;
            await tenantClient.PostAsync("/api/v1/tenant/lease/cancel", content: null);
        }
    }
}
