using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using MyProperty.Application.Common;
using MyProperty.Application.Invites;
using MyProperty.Application.Invites.Commands.ResendInvite;
using MyProperty.Application.Invites.Queries.GetInviteByToken;
using MyProperty.Application.Invites.Queries.GetLandlordInvites;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;
using MyProperty.Tests.Integration.Fixtures;

namespace MyProperty.Tests.Integration;

/// <summary>
/// Invite management surface (Plan 2 / D4): landlord list + status filter,
/// revoke transitions + ownership/status guards, and resend re-issuing a token
/// (old link dies, new link previews, expiry reset, email re-enqueued).
/// Assertions key off seeded invite ids rather than absolute counts because the
/// Postgres container is shared across the integration collection.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class InviteManagementTests(ApiFixture fixture)
{
    [Fact]
    public async Task List_returns_landlords_invites_and_filters_by_status()
    {
        var (client, landlordId) = await LandlordWithRowAsync(ApiFixture.LandlordEmail);
        var propertyId = await SeedPropertyAsync(landlordId, "List Test Apt");

        var (pendingId, _) = await SeedInviteAsync(landlordId, propertyId, status: InviteStatus.Pending);
        var (revokedId, _) = await SeedInviteAsync(landlordId, propertyId, status: InviteStatus.Revoked);

        // Unfiltered list contains both.
        var all = await client.GetFromJsonAsync<PagedResult<InviteListItemDto>>(
            "/api/v1/invites?page=1&pageSize=100", ApiFixture.JsonOptions);
        Assert.NotNull(all);
        var seeded = Assert.Single(all!.Items, i => i.Id == pendingId);
        Assert.Equal("List Test Apt", seeded.PropertyName);
        Assert.Equal("managed-tenant@test.local", seeded.Email);
        Assert.Contains(all.Items, i => i.Id == revokedId);

        // Status filter narrows to Revoked only.
        var revokedOnly = await client.GetFromJsonAsync<PagedResult<InviteListItemDto>>(
            "/api/v1/invites?status=Revoked&pageSize=100", ApiFixture.JsonOptions);
        Assert.NotNull(revokedOnly);
        Assert.Contains(revokedOnly!.Items, i => i.Id == revokedId);
        Assert.DoesNotContain(revokedOnly.Items, i => i.Id == pendingId);
        Assert.All(revokedOnly.Items, i => Assert.Equal(InviteStatus.Revoked, i.Status));
    }

    [Fact]
    public async Task Tenant_cannot_list_invites()
    {
        var tenantClient = await fixture.CreateAuthenticatedClientAsync(ApiFixture.TenantEmail);
        var resp = await tenantClient.GetAsync("/api/v1/invites");
        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task Revoke_transitions_pending_to_revoked()
    {
        var (client, landlordId) = await LandlordWithRowAsync(ApiFixture.LandlordEmail);
        var propertyId = await SeedPropertyAsync(landlordId, "Revoke Apt");
        var (inviteId, _) = await SeedInviteAsync(landlordId, propertyId, status: InviteStatus.Pending);

        var resp = await client.PostAsync($"/api/v1/invites/{inviteId}/revoke", content: null);
        Assert.Equal(HttpStatusCode.NoContent, resp.StatusCode);

        await fixture.WithDbAsync(async db =>
            Assert.Equal(InviteStatus.Revoked, (await db.Invites.FirstAsync(i => i.Id == inviteId)).Status));
    }

    [Fact]
    public async Task Revoke_returns_409_for_accepted_invite()
    {
        var (client, landlordId) = await LandlordWithRowAsync(ApiFixture.LandlordEmail);
        var propertyId = await SeedPropertyAsync(landlordId, "Revoke Accepted Apt");
        var (inviteId, _) = await SeedInviteAsync(landlordId, propertyId, status: InviteStatus.Accepted);

        var resp = await client.PostAsync($"/api/v1/invites/{inviteId}/revoke", content: null);
        Assert.Equal(HttpStatusCode.Conflict, resp.StatusCode);
    }

    [Fact]
    public async Task Revoke_returns_403_for_another_landlords_invite()
    {
        var (_, l1Id) = await LandlordWithRowAsync(ApiFixture.LandlordEmail);
        var propertyId = await SeedPropertyAsync(l1Id, "L1 Apt");
        var (inviteId, _) = await SeedInviteAsync(l1Id, propertyId, status: InviteStatus.Pending);

        var (l2Client, _) = await LandlordWithRowAsync(ApiFixture.Landlord2Email);
        var resp = await l2Client.PostAsync($"/api/v1/invites/{inviteId}/revoke", content: null);
        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);

        await fixture.WithDbAsync(async db =>
            Assert.Equal(InviteStatus.Pending, (await db.Invites.FirstAsync(i => i.Id == inviteId)).Status));
    }

    [Fact]
    public async Task Resend_reissues_token_old_link_dies_and_new_link_previews()
    {
        var (client, landlordId) = await LandlordWithRowAsync(ApiFixture.LandlordEmail);
        var propertyId = await SeedPropertyAsync(landlordId, "Resend Apt");
        // Seed as Expired to also prove resend re-activates to Pending.
        var (inviteId, oldToken) = await SeedInviteAsync(
            landlordId, propertyId, status: InviteStatus.Expired,
            expiresAt: DateTime.UtcNow.AddDays(-1));

        // The old token still resolves (preview is status-aware) — as Expired.
        var anon = fixture.CreateClient();
        var beforePreview = await anon.GetFromJsonAsync<InvitePreviewDto>(
            $"/api/v1/invites/by-token/{oldToken}", ApiFixture.JsonOptions);
        Assert.Equal(InviteStatus.Expired, beforePreview!.Status);

        fixture.Queue.Clear();
        var resp = await client.PostAsync($"/api/v1/invites/{inviteId}/resend", content: null);
        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var resent = await resp.Content.ReadFromJsonAsync<InviteResentDto>();
        Assert.NotNull(resent);
        Assert.Equal(inviteId, resent!.InviteId);
        Assert.True(resent.ExpiresAt > DateTime.UtcNow.AddDays(6));

        // Old token no longer resolves — the hash was overwritten.
        var deadResp = await anon.GetAsync($"/api/v1/invites/by-token/{oldToken}");
        Assert.Equal(HttpStatusCode.NotFound, deadResp.StatusCode);

        // The re-enqueued email carries a fresh token that previews as Pending again.
        var email = Assert.Single(fixture.Queue.Emails);
        var newToken = ExtractTokenFromEmailBody(email.Body);
        Assert.NotEqual(oldToken, newToken);

        var afterPreview = await anon.GetFromJsonAsync<InvitePreviewDto>(
            $"/api/v1/invites/by-token/{newToken}", ApiFixture.JsonOptions);
        Assert.Equal(InviteStatus.Pending, afterPreview!.Status);

        await fixture.WithDbAsync(async db =>
        {
            var row = await db.Invites.FirstAsync(i => i.Id == inviteId);
            Assert.Equal(InviteStatus.Pending, row.Status);
            Assert.Equal(InviteTokenHasher.Hash(newToken), row.TokenHash);
        });
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private async Task<(HttpClient Client, Guid LandlordId)> LandlordWithRowAsync(string email)
    {
        var client = await fixture.CreateAuthenticatedClientAsync(email);
        await client.GetAsync("/api/v1/me"); // lazy-upsert the User row
        var id = await fixture.WithDbAsync(async db =>
            (await db.Users.FirstAsync(u => u.Email == email)).Id);
        return (client, id);
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
                Address = "1 Management St",
            });
            await db.SaveChangesAsync();
            return propertyId;
        });
    }

    private async Task<(Guid InviteId, string PlainToken)> SeedInviteAsync(
        Guid landlordId, Guid propertyId, InviteStatus status, DateTime? expiresAt = null)
    {
        var inviteId = Guid.NewGuid();
        var plainToken = "T" + Convert.ToHexString(Guid.NewGuid().ToByteArray()).ToLowerInvariant();
        var hash = InviteTokenHasher.Hash(plainToken);

        await fixture.WithDbAsync(async db =>
        {
            db.Invites.Add(new Invite
            {
                Id = inviteId,
                LandlordId = landlordId,
                PropertyId = propertyId,
                Email = "managed-tenant@test.local",
                FirstName = "Managed",
                LastName = "Tenant",
                TokenHash = hash,
                Status = status,
                ExpiresAt = expiresAt ?? DateTime.UtcNow.AddDays(7),
                ProposedStartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(1),
                ProposedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
                ProposedMonthlyRent = 1100m,
                Currency = "EUR",
            });
            await db.SaveChangesAsync();
        });

        return (inviteId, plainToken);
    }

    private static string ExtractTokenFromEmailBody(string body)
    {
        var match = Regex.Match(body, @"/invites/([A-Za-z0-9_-]{20,100})");
        Assert.True(match.Success, $"Could not find invite token in email body:\n{body}");
        return match.Groups[1].Value;
    }
}
