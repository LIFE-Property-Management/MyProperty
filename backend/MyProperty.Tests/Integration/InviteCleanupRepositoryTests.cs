using Microsoft.EntityFrameworkCore;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;
using MyProperty.Infrastructure.Persistence;
using MyProperty.Infrastructure.Persistence.Repositories;
using MyProperty.Tests.Integration.Fixtures;

namespace MyProperty.Tests.Integration;

/// <summary>
/// Exercises the invite-cleanup repository queries that back the recurring
/// Hangfire jobs (<c>MarkExpiredInvites</c>, <c>OrphanCleanup</c>) against real
/// Postgres — the filters, the set-based <c>ExecuteDeleteAsync</c>, and its
/// interaction with the global soft-delete query filter. Assertions key off the
/// specific seeded ids so they stay robust to rows other tests leave behind.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class InviteCleanupRepositoryTests(ApiFixture fixture)
{
    private static readonly Guid LandlordId = new("33333333-3333-3333-3333-cccccccccccc");
    private static readonly Guid PropertyId = new("44444444-4444-4444-4444-dddddddddddd");

    private static async Task EnsureParentsAsync(AppDbContext db)
    {
        if (await db.Users.FindAsync(LandlordId) is null)
            db.Users.Add(new User
            {
                Id = LandlordId,
                KeycloakSubId = "synthetic-landlord-cleanup-tests",
                Email = "synthetic-cleanup-landlord@test.local",
                FirstName = "Synth",
                LastName = "Cleanup",
            });

        if (await db.Properties.FindAsync(PropertyId) is null)
            db.Properties.Add(new Property
            {
                Id = PropertyId,
                LandlordId = LandlordId,
                Name = "Cleanup Property",
                Address = "1 Cleanup Way",
            });
    }

    private static Invite NewInvite(InviteStatus status, DateTime expiresAt) => new()
    {
        Id = Guid.NewGuid(),
        LandlordId = LandlordId,
        PropertyId = PropertyId,
        Email = "cleanup@example.com",
        FirstName = "Clean",
        LastName = "Up",
        TokenHash = Convert.ToHexString(Guid.NewGuid().ToByteArray()).ToLowerInvariant().PadRight(64, '0'),
        Status = status,
        ExpiresAt = expiresAt,
        ProposedStartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date),
        ProposedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
        ProposedMonthlyRent = 1000m,
        Currency = "EUR",
    };

    [Fact]
    public async Task GetPendingExpiredAsOf_returns_only_pending_invites_past_expiry()
    {
        var pendingPast = NewInvite(InviteStatus.Pending, DateTime.UtcNow.AddDays(-1));
        var pendingFuture = NewInvite(InviteStatus.Pending, DateTime.UtcNow.AddDays(7));
        var acceptedPast = NewInvite(InviteStatus.Accepted, DateTime.UtcNow.AddDays(-1));

        await fixture.WithDbAsync(async db =>
        {
            await EnsureParentsAsync(db);
            db.Invites.AddRange(pendingPast, pendingFuture, acceptedPast);
            await db.SaveChangesAsync();

            var repo = new InviteRepository(db);
            var result = await repo.GetPendingExpiredAsOfAsync(DateTime.UtcNow, CancellationToken.None);

            var ids = result.Select(i => i.Id).ToHashSet();
            Assert.Contains(pendingPast.Id, ids);          // Pending + past  → included
            Assert.DoesNotContain(pendingFuture.Id, ids);  // Pending + future → excluded
            Assert.DoesNotContain(acceptedPast.Id, ids);   // Accepted        → excluded
        });
    }

    [Fact]
    public async Task DeleteExpiredOlderThan_purges_only_old_expired_invites()
    {
        var expiredOld = NewInvite(InviteStatus.Expired, DateTime.UtcNow.AddDays(-40));
        var expiredRecent = NewInvite(InviteStatus.Expired, DateTime.UtcNow.AddDays(-40));
        var acceptedOld = NewInvite(InviteStatus.Accepted, DateTime.UtcNow.AddDays(-40));

        await fixture.WithDbAsync(async db =>
        {
            await EnsureParentsAsync(db);
            db.Invites.AddRange(expiredOld, expiredRecent, acceptedOld);
            await db.SaveChangesAsync();

            // CreatedAt is stamped to "now" by the auditing interceptor on insert,
            // so age the two "old" rows past the 30-day cutoff via a set-based
            // UPDATE (which bypasses the interceptor) to set up the scenario.
            var aged = DateTime.UtcNow.AddDays(-31);
            await db.Invites
                .Where(i => i.Id == expiredOld.Id || i.Id == acceptedOld.Id)
                .ExecuteUpdateAsync(s => s.SetProperty(i => i.CreatedAt, aged), CancellationToken.None);

            var repo = new InviteRepository(db);
            var cutoff = DateTime.UtcNow.AddDays(-30);
            var deleted = await repo.DeleteExpiredOlderThanAsync(cutoff, CancellationToken.None);

            Assert.True(deleted >= 1);

            // Expired + older than 30d → purged.
            Assert.False(await db.Invites.AnyAsync(i => i.Id == expiredOld.Id));
            // Expired but created < 30d ago → kept.
            Assert.True(await db.Invites.AnyAsync(i => i.Id == expiredRecent.Id));
            // Old but not Expired (Accepted) → kept.
            Assert.True(await db.Invites.AnyAsync(i => i.Id == acceptedOld.Id));
        });
    }
}
