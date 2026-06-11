using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using MyProperty.Application.Invites;
using MyProperty.Application.Invites.Commands.AcceptInvite;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;
using MyProperty.Tests.Integration.Fixtures;

namespace MyProperty.Tests.Integration;

/// <summary>
/// Returning-tenant accept (D1): an authenticated tenant who already has an
/// account claims an invite addressed to their email via
/// <c>POST /invites/{token}/claim</c>. Asserts a Lease is created and the invite
/// is Accepted, with no new Keycloak user provisioned (the existing account is
/// reused). Also covers the email-mismatch 403 guard.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class ClaimInviteFlowTests(ApiFixture fixture)
{
    [Fact]
    public async Task Returning_tenant_claims_invite_reusing_existing_account()
    {
        // ── 1. Landlord + property setup.
        var landlordClient = await fixture.CreateAuthenticatedClientAsync(ApiFixture.LandlordEmail);
        await landlordClient.GetAsync("/api/v1/me");
        var landlordId = await fixture.WithDbAsync(async db =>
            (await db.Users.FirstAsync(u => u.Email == ApiFixture.LandlordEmail)).Id);

        var propertyId = Guid.NewGuid();
        await fixture.WithDbAsync(async db =>
        {
            db.Properties.Add(new Property
            {
                Id = propertyId,
                LandlordId = landlordId,
                Name = "Claim Test Apt",
                Address = "3 Returning Way",
            });
            await db.SaveChangesAsync();
        });

        // ── 2. The tenant is a pre-seeded Keycloak user (returning tenant). Hit
        //      /me so their User row exists, then record the existing user count
        //      for the no-new-account assertion.
        var tenantClient = await fixture.CreateAuthenticatedClientAsync(ApiFixture.TenantEmail);
        await tenantClient.GetAsync("/api/v1/me");
        var (tenantUserId, usersBefore) = await fixture.WithDbAsync(async db =>
        {
            var tenant = await db.Users.FirstAsync(u => u.Email == ApiFixture.TenantEmail);
            var count = await db.Users.CountAsync();
            return (tenant.Id, count);
        });

        // ── 3. Landlord invites the returning tenant.
        var token = await SeedInviteAsync(landlordId, propertyId, ApiFixture.TenantEmail);

        // ── 4. Tenant claims the invite (authenticated, no body).
        var claimResp = await tenantClient.PostAsync($"/api/v1/invites/{token}/claim", content: null);
        Assert.Equal(HttpStatusCode.OK, claimResp.StatusCode);
        var accepted = await claimResp.Content.ReadFromJsonAsync<InviteAcceptedDto>();
        Assert.NotNull(accepted);
        Assert.NotEqual(Guid.Empty, accepted!.LeaseId);

        // ── 5. A Lease exists for the existing tenant, the invite is Accepted,
        //      and no new User row was created (account reused, not provisioned).
        await fixture.WithDbAsync(async db =>
        {
            var lease = await db.Leases.FirstAsync(l => l.Id == accepted.LeaseId);
            Assert.Equal(LeaseStatus.Active, lease.Status);
            Assert.Equal(landlordId, lease.LandlordId);
            Assert.Equal(propertyId, lease.PropertyId);
            Assert.Equal(tenantUserId, lease.TenantId);

            var inviteRow = await db.Invites.FirstAsync(i => i.Id == accepted.InviteId);
            Assert.Equal(InviteStatus.Accepted, inviteRow.Status);
            Assert.NotNull(inviteRow.AcceptedAt);

            var usersAfter = await db.Users.CountAsync();
            Assert.Equal(usersBefore, usersAfter);
        });
    }

    [Fact]
    public async Task Claim_returns_403_when_invite_addressed_to_a_different_email()
    {
        var landlordClient = await fixture.CreateAuthenticatedClientAsync(ApiFixture.LandlordEmail);
        await landlordClient.GetAsync("/api/v1/me");
        var landlordId = await fixture.WithDbAsync(async db =>
            (await db.Users.FirstAsync(u => u.Email == ApiFixture.LandlordEmail)).Id);

        var propertyId = Guid.NewGuid();
        await fixture.WithDbAsync(async db =>
        {
            db.Properties.Add(new Property
            {
                Id = propertyId,
                LandlordId = landlordId,
                Name = "Mismatch Apt",
                Address = "4 Wrong St",
            });
            await db.SaveChangesAsync();
        });

        // Invite addressed to someone other than the authenticated tenant.
        var token = await SeedInviteAsync(landlordId, propertyId, "someone-else@test.local");

        var tenantClient = await fixture.CreateAuthenticatedClientAsync(ApiFixture.TenantEmail);
        var resp = await tenantClient.PostAsync($"/api/v1/invites/{token}/claim", content: null);

        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task Claim_requires_authentication()
    {
        var anonClient = fixture.CreateClient();
        var resp = await anonClient.PostAsync(
            "/api/v1/invites/some-unauthenticated-token-1234/claim", content: null);

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Claim_returns_409_when_property_already_has_an_active_lease()
    {
        var landlordClient = await fixture.CreateAuthenticatedClientAsync(ApiFixture.LandlordEmail);
        await landlordClient.GetAsync("/api/v1/me");
        var landlordId = await fixture.WithDbAsync(async db =>
            (await db.Users.FirstAsync(u => u.Email == ApiFixture.LandlordEmail)).Id);

        var propertyId = Guid.NewGuid();
        await fixture.WithDbAsync(async db =>
        {
            db.Properties.Add(new Property
            {
                Id = propertyId,
                LandlordId = landlordId,
                Name = "Occupied Apt",
                Address = "5 Taken St",
            });
            // An existing active lease on the property (a different tenant).
            var sittingTenant = new User
            {
                Id = Guid.NewGuid(),
                KeycloakSubId = "kc-sitting-" + Guid.NewGuid().ToString("N"),
                Email = $"sitting-{Guid.NewGuid():N}@test.local",
                FirstName = "Sitting",
                LastName = "Tenant",
                AccountStatus = TenantAccountStatus.Active,
            };
            db.Users.Add(sittingTenant);
            db.Leases.Add(new Lease
            {
                Id = Guid.NewGuid(),
                LandlordId = landlordId,
                PropertyId = propertyId,
                TenantId = sittingTenant.Id,
                StartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(-10),
                EndDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
                MonthlyRent = 1000m,
                Currency = "EUR",
            });
            await db.SaveChangesAsync();
        });

        // The returning tenant holds a valid invite to the now-occupied property.
        var token = await SeedInviteAsync(landlordId, propertyId, ApiFixture.TenantEmail);

        var tenantClient = await fixture.CreateAuthenticatedClientAsync(ApiFixture.TenantEmail);
        await tenantClient.GetAsync("/api/v1/me");
        var resp = await tenantClient.PostAsync($"/api/v1/invites/{token}/claim", content: null);

        // Handler guard returns a clean 409 (not a 500 from the DB unique index).
        Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode);

        // No second lease was created on the property.
        await fixture.WithDbAsync(async db =>
            Assert.Equal(1, await db.Leases.CountAsync(l => l.PropertyId == propertyId)));
    }

    /// <summary>
    /// Inserts an invite row directly (storing only the SHA256 hash, mirroring
    /// production) and returns the plain token.
    /// </summary>
    private async Task<string> SeedInviteAsync(Guid landlordId, Guid propertyId, string email)
    {
        var plainToken = "T" + Convert.ToHexString(Guid.NewGuid().ToByteArray()).ToLowerInvariant();
        var hash = InviteTokenHasher.Hash(plainToken);

        await fixture.WithDbAsync(async db =>
        {
            db.Invites.Add(new Invite
            {
                Id = Guid.NewGuid(),
                LandlordId = landlordId,
                PropertyId = propertyId,
                Email = email,
                FirstName = "Returning",
                LastName = "Tenant",
                TokenHash = hash,
                Status = InviteStatus.Pending,
                ExpiresAt = DateTime.UtcNow.AddDays(7),
                ProposedStartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(1),
                ProposedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
                ProposedMonthlyRent = 1200m,
                Currency = "EUR",
            });
            await db.SaveChangesAsync();
        });

        return plainToken;
    }
}
