using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using MyProperty.Application.Invites.Commands.AcceptInvite;
using MyProperty.Application.Invites.Commands.CreateInvite;
using MyProperty.Application.Invites.Events;
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
/// Lease row and Keycloak user in the live containers.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class InviteFlowTests(ApiFixture fixture)
{
    [Fact]
    public async Task End_to_end_invite_flow()
    {
        // ── 1. Lazy-upsert landlord's User row by hitting /me, then seed a
        //      Property they own.
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

        // ── 2. Landlord creates an invite for a fresh (never-seen) email.
        //      Must NOT be one of the pre-seeded Keycloak users so the
        //      provisioner can create the account from scratch.
        const string freshEmail = "fresh-tenant@test.local";
        fixture.Queue.Clear();
        var createCmd = new CreateInviteCommand(
            PropertyId: propertyId,
            Email: freshEmail,
            FirstName: "Fresh",
            LastName: "Tenant",
            ProposedStartDate: DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(1),
            ProposedEndDate: DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
            ProposedMonthlyRent: 950m,
            Currency: "EUR");

        var createResp = await landlordClient.PostAsJsonAsync("/api/v1/invites", createCmd);
        Assert.Equal(HttpStatusCode.OK, createResp.StatusCode);
        var created = await createResp.Content.ReadFromJsonAsync<InviteCreatedDto>();
        Assert.NotNull(created);

        // ── 3. Extract the plain token from the captured email.
        var email = Assert.Single(fixture.Queue.Emails);
        Assert.Equal(freshEmail, email.To);
        var plainToken = ExtractTokenFromEmailBody(email.Body);
        Assert.NotNull(plainToken);

        // ── 4. Anonymous preview by token returns the invite details.
        var anonClient = fixture.CreateClient();
        var previewResp = await anonClient.GetAsync($"/api/v1/invites/by-token/{plainToken}");
        Assert.Equal(HttpStatusCode.OK, previewResp.StatusCode);
        var preview = await previewResp.Content.ReadFromJsonAsync<InvitePreviewDto>(ApiFixture.JsonOptions);
        Assert.NotNull(preview);
        Assert.Equal("Sunset Apt 12B", preview!.PropertyName);
        Assert.Equal(freshEmail, preview.TenantEmail);
        Assert.Equal(950m, preview.ProposedMonthlyRent);

        // ── 5. Anonymous accept — no Bearer header; new JSON body shape.
        const string tenantPassword = "Tenant1Pass!";
        var acceptResp = await anonClient.PostAsJsonAsync(
            $"/api/v1/invites/{plainToken}/accept",
            new { firstName = "Fresh", lastName = "Tenant", phone = (string?)null, password = tenantPassword });

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

            // User row was created directly (not via lazy-sync).
            var user = await db.Users.FirstAsync(u => u.Email == freshEmail);
            Assert.Equal(TenantAccountStatus.Active, user.AccountStatus);
        });

        // ── 6b. InviteAccepted event was published after commit (drives the
        //       landlord's SignalR push + notification email via the consumer).
        var acceptedEvent = Assert.Single(
            fixture.Events.Events.OfType<InviteAcceptedEvent>(), e => e.InviteId == accepted.InviteId);
        Assert.Equal(landlordUserId, acceptedEvent.LandlordId);
        Assert.Equal("Sunset Apt 12B", acceptedEvent.PropertyName);
        Assert.Equal("Fresh Tenant", acceptedEvent.TenantName);

        // ── 7. Replaying the same token returns 404 (invite is no longer Pending).
        var replayResp = await anonClient.PostAsJsonAsync(
            $"/api/v1/invites/{plainToken}/accept",
            new { firstName = "Fresh", lastName = "Tenant", phone = (string?)null, password = tenantPassword });
        Assert.Equal(HttpStatusCode.NotFound, replayResp.StatusCode);

        // ── 8. The new Keycloak user can authenticate with the chosen password.
        //      This confirms the provisioner wired the password correctly.
        var newToken = await fixture.GetTokenForNewUserAsync(freshEmail, tenantPassword);
        Assert.NotEmpty(newToken);
    }

    [Fact]
    public async Task Second_accept_for_same_email_returns_conflict()
    {
        // Landlord + property setup.
        var landlordClient = await fixture.CreateAuthenticatedClientAsync(ApiFixture.Landlord2Email);
        await landlordClient.GetAsync("/api/v1/me");
        var landlordId = await fixture.WithDbAsync(async db =>
            (await db.Users.FirstAsync(u => u.Email == ApiFixture.Landlord2Email)).Id);

        var propertyId = Guid.NewGuid();
        await fixture.WithDbAsync(async db =>
        {
            db.Properties.Add(new Property
            {
                Id = propertyId,
                LandlordId = landlordId,
                Name = "Conflict Test Apt",
                Address = "2 Main St",
            });
            await db.SaveChangesAsync();
        });

        const string conflictEmail = "conflict-tenant@test.local";
        const string conflictPassword = "ConflictPass1!";

        // Create first invite and accept it.
        fixture.Queue.Clear();
        var firstCreate = await landlordClient.PostAsJsonAsync("/api/v1/invites", new CreateInviteCommand(
            propertyId, conflictEmail, "Conflict", "Tenant",
            DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(1),
            DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
            1100m, "EUR"));
        Assert.Equal(HttpStatusCode.OK, firstCreate.StatusCode);
        var firstToken = ExtractTokenFromEmailBody(fixture.Queue.Emails.Last().Body);

        var anonClient = fixture.CreateClient();
        var firstAccept = await anonClient.PostAsJsonAsync(
            $"/api/v1/invites/{firstToken}/accept",
            new { firstName = "Conflict", lastName = "Tenant", phone = (string?)null, password = conflictPassword });
        Assert.Equal(HttpStatusCode.OK, firstAccept.StatusCode);

        // Create a second invite for the same email and try to accept it.
        fixture.Queue.Clear();
        var secondCreate = await landlordClient.PostAsJsonAsync("/api/v1/invites", new CreateInviteCommand(
            propertyId, conflictEmail, "Conflict", "Tenant",
            DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(1),
            DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
            1100m, "EUR"));
        Assert.Equal(HttpStatusCode.OK, secondCreate.StatusCode);
        var secondToken = ExtractTokenFromEmailBody(fixture.Queue.Emails.Last().Body);

        var secondAccept = await anonClient.PostAsJsonAsync(
            $"/api/v1/invites/{secondToken}/accept",
            new { firstName = "Conflict", lastName = "Tenant", phone = (string?)null, password = conflictPassword });

        Assert.Equal(HttpStatusCode.Conflict, secondAccept.StatusCode);
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
        await landlord2Client.GetAsync("/api/v1/me");

        var resp = await landlord2Client.PostAsJsonAsync("/api/v1/invites", new CreateInviteCommand(
            propertyId, ApiFixture.TenantEmail, "Tenant", "X",
            DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(1),
            DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
            900m, "EUR"));

        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    private static string ExtractTokenFromEmailBody(string body)
    {
        var match = Regex.Match(body, @"/invites/([A-Za-z0-9_-]{20,100})");
        Assert.True(match.Success, $"Could not find invite token in email body:\n{body}");
        return match.Groups[1].Value;
    }
}
