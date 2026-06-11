using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using MyProperty.Application.Common;
using MyProperty.Application.Invites;
using MyProperty.Application.Properties.Queries.GetLandlordProperties;
using MyProperty.Application.Properties.Queries.GetPropertyById;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;
using MyProperty.Tests.Integration.Fixtures;

namespace MyProperty.Tests.Integration;

/// <summary>
/// Per-property occupancy state (Plan 2 / D7): the landlord property list and
/// detail DTOs expose <c>HasActiveLease</c> + <c>HasPendingInvite</c> so the UI
/// can render Vacant / Invite-pending / Leased. Asserts each state against
/// seeded leases/invites. The expired-but-unswept invite must read as
/// <c>HasPendingInvite = false</c> (effective-pending semantics).
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class PropertyOccupancyTests(ApiFixture fixture)
{
    [Fact]
    public async Task Vacant_property_has_no_lease_and_no_pending_invite()
    {
        var (client, landlordId) = await LandlordWithRowAsync();
        var propertyId = await SeedPropertyAsync(landlordId, "Vacant Apt");

        var detail = await client.GetFromJsonAsync<PropertyDetailDto>(
            $"/api/v1/properties/{propertyId}", ApiFixture.JsonOptions);
        Assert.False(detail!.HasActiveLease);
        Assert.False(detail.HasPendingInvite);

        var listed = await ListItemAsync(client, propertyId);
        Assert.False(listed.HasActiveLease);
        Assert.False(listed.HasPendingInvite);
        Assert.Null(listed.ActiveLeaseId);
    }

    [Fact]
    public async Task Property_with_pending_invite_reads_invite_pending_not_leased()
    {
        var (client, landlordId) = await LandlordWithRowAsync();
        var propertyId = await SeedPropertyAsync(landlordId, "Invited Apt");
        await SeedInviteAsync(landlordId, propertyId, InviteStatus.Pending, DateTime.UtcNow.AddDays(7));

        var detail = await client.GetFromJsonAsync<PropertyDetailDto>(
            $"/api/v1/properties/{propertyId}", ApiFixture.JsonOptions);
        Assert.True(detail!.HasPendingInvite);
        Assert.False(detail.HasActiveLease);

        var listed = await ListItemAsync(client, propertyId);
        Assert.True(listed.HasPendingInvite);
        Assert.False(listed.HasActiveLease);
    }

    [Fact]
    public async Task Property_with_expired_invite_is_not_pending()
    {
        var (client, landlordId) = await LandlordWithRowAsync();
        var propertyId = await SeedPropertyAsync(landlordId, "Lapsed Apt");
        // Pending status but past ExpiresAt (not yet swept) — must NOT read as pending.
        await SeedInviteAsync(landlordId, propertyId, InviteStatus.Pending, DateTime.UtcNow.AddDays(-1));

        var detail = await client.GetFromJsonAsync<PropertyDetailDto>(
            $"/api/v1/properties/{propertyId}", ApiFixture.JsonOptions);
        Assert.False(detail!.HasPendingInvite);
        Assert.False(detail.HasActiveLease);
    }

    [Fact]
    public async Task Property_with_active_lease_reads_leased()
    {
        var (client, landlordId) = await LandlordWithRowAsync();
        var propertyId = await SeedPropertyAsync(landlordId, "Leased Apt");
        var leaseId = await SeedActiveLeaseAsync(landlordId, propertyId);

        var detail = await client.GetFromJsonAsync<PropertyDetailDto>(
            $"/api/v1/properties/{propertyId}", ApiFixture.JsonOptions);
        Assert.True(detail!.HasActiveLease);
        // The active lease's id rides on its tenant row so the UI can terminate it.
        Assert.Equal(leaseId, Assert.Single(detail.Tenants).LeaseId);

        var listed = await ListItemAsync(client, propertyId);
        Assert.True(listed.HasActiveLease);
        Assert.Equal(leaseId, listed.ActiveLeaseId);
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private async Task<(HttpClient Client, Guid LandlordId)> LandlordWithRowAsync()
    {
        var client = await fixture.CreateAuthenticatedClientAsync(ApiFixture.LandlordEmail);
        await client.GetAsync("/api/v1/me");
        var id = await fixture.WithDbAsync(async db =>
            (await db.Users.FirstAsync(u => u.Email == ApiFixture.LandlordEmail)).Id);
        return (client, id);
    }

    private async Task<PropertyDto> ListItemAsync(HttpClient client, Guid propertyId)
    {
        var page = await client.GetFromJsonAsync<PagedResult<PropertyDto>>(
            "/api/v1/properties?page=1&pageSize=100", ApiFixture.JsonOptions);
        return Assert.Single(page!.Items, p => p.Id == propertyId);
    }

    private Task<Guid> SeedPropertyAsync(Guid landlordId, string name)
    {
        var propertyId = Guid.NewGuid();
        return fixture.WithDbAsync(async db =>
        {
            db.Properties.Add(new Property
            {
                Id = propertyId,
                LandlordId = landlordId,
                Name = name,
                Address = "1 Occupancy St",
            });
            await db.SaveChangesAsync();
            return propertyId;
        });
    }

    private Task SeedInviteAsync(Guid landlordId, Guid propertyId, InviteStatus status, DateTime expiresAt) =>
        fixture.WithDbAsync(async db =>
        {
            var plainToken = "T" + Convert.ToHexString(Guid.NewGuid().ToByteArray()).ToLowerInvariant();
            db.Invites.Add(new Invite
            {
                Id = Guid.NewGuid(),
                LandlordId = landlordId,
                PropertyId = propertyId,
                Email = "occupancy-tenant@test.local",
                FirstName = "Occ",
                LastName = "Tenant",
                TokenHash = InviteTokenHasher.Hash(plainToken),
                Status = status,
                ExpiresAt = expiresAt,
                ProposedStartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(1),
                ProposedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
                ProposedMonthlyRent = 1000m,
                Currency = "EUR",
            });
            await db.SaveChangesAsync();
        });

    private Task<Guid> SeedActiveLeaseAsync(Guid landlordId, Guid propertyId) =>
        fixture.WithDbAsync(async db =>
        {
            var tenant = new User
            {
                Id = Guid.NewGuid(),
                KeycloakSubId = "kc-occ-" + Guid.NewGuid().ToString("N"),
                Email = $"occ-{Guid.NewGuid():N}@test.local",
                FirstName = "Leased",
                LastName = "Tenant",
                AccountStatus = TenantAccountStatus.Active,
            };
            db.Users.Add(tenant);
            var leaseId = Guid.NewGuid();
            db.Leases.Add(new Lease
            {
                Id = leaseId,
                LandlordId = landlordId,
                PropertyId = propertyId,
                TenantId = tenant.Id,
                StartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(-30),
                EndDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
                MonthlyRent = 1000m,
                Currency = "EUR",
            });
            await db.SaveChangesAsync();
            return leaseId;
        });
}
