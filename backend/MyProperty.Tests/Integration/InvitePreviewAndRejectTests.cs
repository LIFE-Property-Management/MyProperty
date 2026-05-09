using System.Net;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;
using MyProperty.Tests.Integration.Fixtures;

namespace MyProperty.Tests.Integration;

/// <summary>
/// Anonymous invite endpoints — preview (GET) and reject (POST). Tests cover
/// the 404 cases (missing / non-Pending / expired) and the happy reject path,
/// asserting the DB row reflects the new status.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class InvitePreviewAndRejectTests(ApiFixture fixture)
{
    [Fact]
    public async Task Preview_returns_404_for_unknown_token()
    {
        var client = fixture.CreateClient();
        var resp = await client.GetAsync("/api/v1/invites/by-token/this-token-doesnotexist123");
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Preview_returns_400_for_malformed_token()
    {
        var client = fixture.CreateClient();
        var resp = await client.GetAsync("/api/v1/invites/by-token/short");
        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Preview_returns_404_for_expired_invite()
    {
        var (_, plainToken) = await SeedInviteAsync(
            status: InviteStatus.Pending,
            expiresAt: DateTime.UtcNow.AddSeconds(-1));

        var client = fixture.CreateClient();
        var resp = await client.GetAsync($"/api/v1/invites/by-token/{plainToken}");
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Theory]
    [InlineData(InviteStatus.Accepted)]
    [InlineData(InviteStatus.Rejected)]
    [InlineData(InviteStatus.Expired)]
    public async Task Preview_returns_404_for_non_pending_invite(InviteStatus status)
    {
        var (_, plainToken) = await SeedInviteAsync(status);

        var client = fixture.CreateClient();
        var resp = await client.GetAsync($"/api/v1/invites/by-token/{plainToken}");
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Reject_marks_invite_rejected_anonymously()
    {
        var (inviteId, plainToken) = await SeedInviteAsync();

        var client = fixture.CreateClient();
        var resp = await client.PostAsync($"/api/v1/invites/{plainToken}/reject", content: null);

        Assert.Equal(HttpStatusCode.NoContent, resp.StatusCode);
        await fixture.WithDbAsync(async db =>
        {
            var row = await db.Invites.FirstAsync(i => i.Id == inviteId);
            Assert.Equal(InviteStatus.Rejected, row.Status);
            Assert.NotNull(row.RejectedAt);
        });
    }

    [Fact]
    public async Task Reject_returns_404_for_unknown_token()
    {
        var client = fixture.CreateClient();
        var resp = await client.PostAsync("/api/v1/invites/this-token-doesnotexist123/reject", content: null);
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Reject_returns_404_after_already_accepted()
    {
        var (_, plainToken) = await SeedInviteAsync(InviteStatus.Accepted);

        var client = fixture.CreateClient();
        var resp = await client.PostAsync($"/api/v1/invites/{plainToken}/reject", content: null);

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    /// <summary>
    /// Inserts a landlord+property+invite row directly via the DbContext —
    /// avoids spending real Keycloak tokens on tests that only care about the
    /// anonymous endpoints. Returns the DB invite ID and the plain token (the
    /// row stores only the SHA256 hash, mirroring production).
    /// </summary>
    private async Task<(Guid InviteId, string PlainToken)> SeedInviteAsync(
        InviteStatus status = InviteStatus.Pending,
        DateTime? expiresAt = null)
    {
        var plainToken = "T" + Convert.ToHexString(Guid.NewGuid().ToByteArray()).ToLowerInvariant();
        var hash = HashToken(plainToken);
        var inviteId = Guid.NewGuid();

        await fixture.WithDbAsync(async db =>
        {
            // Reuse-or-create a synthetic landlord and property — namespaced by
            // a fixed Guid so multiple invocations across tests in this class
            // share the same parent rows.
            var landlordId = new Guid("11111111-1111-1111-1111-aaaaaaaaaaaa");
            var propertyId = new Guid("22222222-2222-2222-2222-bbbbbbbbbbbb");

            var landlord = await db.Users.FirstOrDefaultAsync(u => u.Id == landlordId);
            if (landlord is null)
            {
                landlord = new User
                {
                    Id = landlordId,
                    KeycloakSubId = "synthetic-landlord-anonymous-tests",
                    Email = "synthetic-landlord@test.local",
                    FirstName = "Synth",
                    LastName = "Landlord",
                };
                db.Users.Add(landlord);
            }

            var property = await db.Properties.FirstOrDefaultAsync(p => p.Id == propertyId);
            if (property is null)
            {
                property = new Property
                {
                    Id = propertyId,
                    LandlordId = landlordId,
                    Name = "Synthetic Property",
                    Address = "1 Synthetic Way",
                };
                db.Properties.Add(property);
            }

            db.Invites.Add(new Invite
            {
                Id = inviteId,
                LandlordId = landlordId,
                PropertyId = propertyId,
                Email = "anyone@example.com",
                FirstName = "Any",
                LastName = "Recipient",
                TokenHash = hash,
                Status = status,
                ExpiresAt = expiresAt ?? DateTime.UtcNow.AddDays(7),
                ProposedStartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date),
                ProposedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
                ProposedMonthlyRent = 1000m,
                Currency = "EUR",
            });

            await db.SaveChangesAsync();
        });

        return (inviteId, plainToken);
    }

    private static string HashToken(string plainToken)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(plainToken))).ToLowerInvariant();
}
