using System.Net;
using Microsoft.EntityFrameworkCore;
using MyProperty.Application.Invites;
using MyProperty.Application.Invites.Events;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;
using MyProperty.Tests.Integration.Fixtures;

namespace MyProperty.Tests.Integration;

/// <summary>
/// Verifies the invite-accept/reject handlers publish their integration events
/// after the DB commit (Plan 2). RabbitMQ is disabled in the suite, so the
/// recording <see cref="RecordingEventPublisher"/> captures what production would
/// have put on the bus; the consumers themselves run only against a live broker.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class InviteEventPublishingTests(ApiFixture fixture)
{
    [Fact]
    public async Task Anonymous_reject_publishes_InviteRejectedEvent()
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
                Name = "Reject Event Apt",
                Address = "9 Decline Rd",
            });
            await db.SaveChangesAsync();
        });

        var inviteId = Guid.NewGuid();
        var plainToken = "T" + Convert.ToHexString(Guid.NewGuid().ToByteArray()).ToLowerInvariant();
        await fixture.WithDbAsync(async db =>
        {
            db.Invites.Add(new Invite
            {
                Id = inviteId,
                LandlordId = landlordId,
                PropertyId = propertyId,
                Email = "decliner@test.local",
                FirstName = "De",
                LastName = "Cliner",
                TokenHash = InviteTokenHasher.Hash(plainToken),
                Status = InviteStatus.Pending,
                ExpiresAt = DateTime.UtcNow.AddDays(7),
                ProposedStartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(1),
                ProposedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
                ProposedMonthlyRent = 800m,
                Currency = "EUR",
            });
            await db.SaveChangesAsync();
        });

        fixture.Events.Clear();

        var anon = fixture.CreateClient();
        var resp = await anon.PostAsync($"/api/v1/invites/{plainToken}/reject", content: null);
        Assert.Equal(HttpStatusCode.NoContent, resp.StatusCode);

        var rejected = Assert.Single(
            fixture.Events.Events.OfType<InviteRejectedEvent>(), e => e.InviteId == inviteId);
        Assert.Equal(landlordId, rejected.LandlordId);
        Assert.Equal(propertyId, rejected.PropertyId);
        Assert.Equal("Reject Event Apt", rejected.PropertyName);
    }
}
