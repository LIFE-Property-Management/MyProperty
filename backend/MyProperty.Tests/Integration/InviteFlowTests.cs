using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using MyProperty.Application.Invites.Commands.AcceptInvite;
using MyProperty.Application.Invites.Commands.CreateInvite;
using MyProperty.Application.Invites.Queries.GetInviteByToken;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;
using MyProperty.Tests.Integration.Fixtures;

namespace MyProperty.Tests.Integration;

/// <summary>
/// End-to-end happy path: landlord creates an invite via the API, the
/// background-job queue captures the email (production would deliver it via
/// Hangfire + SMTP), the plain token is extracted from the email body, the
/// tenant fetches a preview anonymously, then accepts — producing a real
/// Lease row in the Postgres container.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class InviteFlowTests(ApiFixture fixture)
{
    [Fact]
    public async Task End_to_end_invite_flow()
    {
        // ── 1. Lazy-upsert landlord's User row by hitting /me, then seed a
        //      Property they own. The CreateInvite handler validates property
        //      ownership against User.Id, so this row must exist first.
        var landlordClient = await fixture.CreateAuthenticatedClientAsync(ApiFixture.LandlordEmail);
        var meResp = await landlordClient.GetAsync("/api/v1/me");
        Assert.Equal(HttpStatusCode.OK, meResp.StatusCode);

        var landlordUserId = await fixture.WithDbAsync(async db =>
            (await db.Users.FirstAsync(u => u.Email == ApiFixture.LandlordEmail)).Id);

        var propertyId = Guid.NewGuid();
        await fixture.WithDbAsync(async db =>
        {
            db.Properties.Add(new Property
            {
                Id = propertyId,
                LandlordId = landlordUserId,
                Name = "Sunset Apt 12B",
                Address = "1 Sunset Blvd, Springfield",
            });
            await db.SaveChangesAsync();
        });

        // ── 2. Landlord creates an invite for the tenant seed user.
        fixture.Queue.Clear();
        var createCmd = new CreateInviteCommand(
            PropertyId: propertyId,
            Email: ApiFixture.TenantEmail,
            FirstName: "Tenant",
            LastName: "Seed",
            ProposedStartDate: DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(1),
            ProposedEndDate: DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
            ProposedMonthlyRent: 950m,
            Currency: "EUR");

        var createResp = await landlordClient.PostAsJsonAsync("/api/v1/invites", createCmd);
        Assert.Equal(HttpStatusCode.OK, createResp.StatusCode);
        var created = await createResp.Content.ReadFromJsonAsync<InviteCreatedDto>();
        Assert.NotNull(created);

        // ── 3. The recorded email contains the plain token in the CTA URL —
        //      mirroring how a real recipient would extract it from their inbox.
        var email = Assert.Single(fixture.Queue.Emails);
        Assert.Equal(ApiFixture.TenantEmail, email.To);
        var plainToken = ExtractTokenFromEmailBody(email.Body);
        Assert.NotNull(plainToken);

        // ── 4. Anonymous preview by token returns the invite details.
        var anonClient = fixture.CreateClient();
        var previewResp = await anonClient.GetAsync($"/api/v1/invites/by-token/{plainToken}");
        Assert.Equal(HttpStatusCode.OK, previewResp.StatusCode);
        var preview = await previewResp.Content.ReadFromJsonAsync<InvitePreviewDto>();
        Assert.NotNull(preview);
        Assert.Equal("Sunset Apt 12B", preview!.PropertyName);
        Assert.Equal(ApiFixture.TenantEmail, preview.TenantEmail);
        Assert.Equal(950m, preview.ProposedMonthlyRent);

        // ── 5. Tenant accepts the invite (email matches their JWT).
        var tenantClient = await fixture.CreateAuthenticatedClientAsync(ApiFixture.TenantEmail);
        var acceptResp = await tenantClient.PostAsJsonAsync(
            $"/api/v1/invites/{plainToken}/accept", new { });
        Assert.Equal(HttpStatusCode.OK, acceptResp.StatusCode);
        var accepted = await acceptResp.Content.ReadFromJsonAsync<InviteAcceptedDto>();
        Assert.NotNull(accepted);
        Assert.Equal(created!.InviteId, accepted!.InviteId);
        Assert.NotEqual(Guid.Empty, accepted.LeaseId);

        // ── 6. Lease and invite state are persisted exactly as advertised.
        await fixture.WithDbAsync(async db =>
        {
            var inviteRow = await db.Invites.FirstAsync(i => i.Id == accepted.InviteId);
            Assert.Equal(InviteStatus.Accepted, inviteRow.Status);
            Assert.NotNull(inviteRow.AcceptedAt);

            var lease = await db.Leases.FirstAsync(l => l.Id == accepted.LeaseId);
            Assert.Equal(LeaseStatus.Active, lease.Status);
            Assert.Equal(landlordUserId, lease.LandlordId);
            Assert.Equal(propertyId, lease.PropertyId);
            Assert.Equal(950m, lease.MonthlyRent);
        });

        // ── 7. Replaying the same token returns 404 (invite is no longer Pending).
        var replayResp = await tenantClient.PostAsJsonAsync(
            $"/api/v1/invites/{plainToken}/accept", new { });
        Assert.Equal(HttpStatusCode.NotFound, replayResp.StatusCode);
    }

    [Fact]
    public async Task Tenant_with_mismatched_email_gets_403_on_accept()
    {
        // Seed landlord User + Property
        var landlordClient = await fixture.CreateAuthenticatedClientAsync(ApiFixture.Landlord2Email);
        await landlordClient.GetAsync("/api/v1/me"); // lazy-upsert

        var landlord2Id = await fixture.WithDbAsync(async db =>
            (await db.Users.FirstAsync(u => u.Email == ApiFixture.Landlord2Email)).Id);

        var propertyId = Guid.NewGuid();
        await fixture.WithDbAsync(async db =>
        {
            db.Properties.Add(new Property
            {
                Id = propertyId,
                LandlordId = landlord2Id,
                Name = "Riverside Loft",
                Address = "5 River Rd",
            });
            await db.SaveChangesAsync();
        });

        fixture.Queue.Clear();
        var createCmd = new CreateInviteCommand(
            propertyId, ApiFixture.TenantEmail, "Tenant", "Two",
            DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(1),
            DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
            1200m, "USD");

        var createResp = await landlordClient.PostAsJsonAsync("/api/v1/invites", createCmd);
        Assert.Equal(HttpStatusCode.OK, createResp.StatusCode);
        var plainToken = ExtractTokenFromEmailBody(fixture.Queue.Emails.Last().Body);

        // Imposter has the Tenant role but a different email. Their JWT email
        // claim won't match the invite — accept must 403, not 404.
        var imposterClient = await fixture.CreateAuthenticatedClientAsync(ApiFixture.ImposterEmail);
        var resp = await imposterClient.PostAsJsonAsync(
            $"/api/v1/invites/{plainToken}/accept", new { });

        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task Tenant_cannot_create_invite()
    {
        var tenantClient = await fixture.CreateAuthenticatedClientAsync(ApiFixture.TenantEmail);
        var resp = await tenantClient.PostAsJsonAsync("/api/v1/invites", new CreateInviteCommand(
            Guid.NewGuid(), "x@x.com", "X", "X",
            DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(1),
            DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
            500m, "EUR"));

        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task Landlord_creating_invite_for_property_they_do_not_own_gets_403()
    {
        // Seed a property owned by Landlord1; Landlord2 attempts to invite to it.
        var landlord1Client = await fixture.CreateAuthenticatedClientAsync(ApiFixture.LandlordEmail);
        await landlord1Client.GetAsync("/api/v1/me");
        var landlord1Id = await fixture.WithDbAsync(async db =>
            (await db.Users.FirstAsync(u => u.Email == ApiFixture.LandlordEmail)).Id);

        var propertyId = Guid.NewGuid();
        await fixture.WithDbAsync(async db =>
        {
            db.Properties.Add(new Property
            {
                Id = propertyId,
                LandlordId = landlord1Id,
                Name = "Owned by L1",
                Address = "1 Main St",
            });
            await db.SaveChangesAsync();
        });

        var landlord2Client = await fixture.CreateAuthenticatedClientAsync(ApiFixture.Landlord2Email);
        await landlord2Client.GetAsync("/api/v1/me"); // ensure user row

        var resp = await landlord2Client.PostAsJsonAsync("/api/v1/invites", new CreateInviteCommand(
            propertyId, ApiFixture.TenantEmail, "Tenant", "X",
            DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(1),
            DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
            900m, "EUR"));

        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    private static string ExtractTokenFromEmailBody(string body)
    {
        // Email body contains the CTA URL: "{PortalBaseUrl}/invites/{plainToken}"
        var match = Regex.Match(body, @"/invites/([A-Za-z0-9_-]{20,100})");
        Assert.True(match.Success, $"Could not find invite token in email body:\n{body}");
        return match.Groups[1].Value;
    }
}
