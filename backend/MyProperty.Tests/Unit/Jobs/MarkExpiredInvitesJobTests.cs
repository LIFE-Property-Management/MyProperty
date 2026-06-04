using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;
using MyProperty.Infrastructure.Jobs;

namespace MyProperty.Tests.Unit.Jobs;

public sealed class MarkExpiredInvitesJobTests
{
    private readonly Mock<IInviteRepository> _invites = new(MockBehavior.Strict);

    private MarkExpiredInvitesJob BuildSut() =>
        new(_invites.Object, NullLogger<MarkExpiredInvitesJob>.Instance);

    private static Invite SeedPending() => new()
    {
        Id = Guid.NewGuid(),
        LandlordId = Guid.NewGuid(),
        PropertyId = Guid.NewGuid(),
        Email = "tenant@example.com",
        FirstName = "Ada",
        LastName = "Lovelace",
        TokenHash = new string('a', 64),
        Status = InviteStatus.Pending,
        ExpiresAt = DateTime.UtcNow.AddDays(-1),
        ProposedStartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date),
        ProposedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
        ProposedMonthlyRent = 1000m,
        Currency = "EUR",
    };

    [Fact]
    public async Task Marks_all_returned_invites_expired_and_saves()
    {
        var a = SeedPending();
        var b = SeedPending();
        _invites.Setup(i => i.GetPendingExpiredAsOfAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(new List<Invite> { a, b });
        _invites.Setup(i => i.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

        await BuildSut().ExecuteAsync(CancellationToken.None);

        Assert.Equal(InviteStatus.Expired, a.Status);
        Assert.Equal(InviteStatus.Expired, b.Status);
        _invites.Verify(i => i.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Does_not_save_when_nothing_is_expired()
    {
        _invites.Setup(i => i.GetPendingExpiredAsOfAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync([]);

        await BuildSut().ExecuteAsync(CancellationToken.None);

        _invites.Verify(i => i.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Queries_with_a_current_utc_cutoff()
    {
        DateTime captured = default;
        _invites.Setup(i => i.GetPendingExpiredAsOfAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .Callback<DateTime, CancellationToken>((asOf, _) => captured = asOf)
                .ReturnsAsync([]);

        var before = DateTime.UtcNow;
        await BuildSut().ExecuteAsync(CancellationToken.None);
        var after = DateTime.UtcNow;

        Assert.InRange(captured, before, after);
    }

    [Fact]
    public async Task Threads_cancellation_token_through_repo_and_save()
    {
        using var cts = new CancellationTokenSource();
        var a = SeedPending();
        _invites.Setup(i => i.GetPendingExpiredAsOfAsync(It.IsAny<DateTime>(), cts.Token))
                .ReturnsAsync(new List<Invite> { a });
        _invites.Setup(i => i.SaveChangesAsync(cts.Token))
                .Returns(Task.CompletedTask);

        await BuildSut().ExecuteAsync(cts.Token);

        _invites.Verify(i => i.GetPendingExpiredAsOfAsync(It.IsAny<DateTime>(), cts.Token), Times.Once);
        _invites.Verify(i => i.SaveChangesAsync(cts.Token), Times.Once);
    }
}
