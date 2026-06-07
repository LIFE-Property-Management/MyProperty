using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Infrastructure.Jobs;

namespace MyProperty.Tests.Unit.Jobs;

public sealed class OrphanCleanupJobTests
{
    private readonly Mock<IInviteRepository> _invites = new(MockBehavior.Strict);

    private OrphanCleanupJob BuildSut() =>
        new(_invites.Object, NullLogger<OrphanCleanupJob>.Instance);

    [Fact]
    public async Task Deletes_expired_orphans_via_repository()
    {
        _invites.Setup(i => i.DeleteExpiredOlderThanAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .ReturnsAsync(5);

        await BuildSut().ExecuteAsync(CancellationToken.None);

        _invites.Verify(i => i.DeleteExpiredOlderThanAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Uses_a_thirty_day_retention_cutoff()
    {
        DateTime captured = default;
        _invites.Setup(i => i.DeleteExpiredOlderThanAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
                .Callback<DateTime, CancellationToken>((cutoff, _) => captured = cutoff)
                .ReturnsAsync(0);

        var expectedBefore = DateTime.UtcNow.AddDays(-30);
        await BuildSut().ExecuteAsync(CancellationToken.None);
        var expectedAfter = DateTime.UtcNow.AddDays(-30);

        Assert.InRange(captured, expectedBefore.AddSeconds(-5), expectedAfter.AddSeconds(5));
    }

    [Fact]
    public async Task Threads_cancellation_token_through_repo()
    {
        using var cts = new CancellationTokenSource();
        _invites.Setup(i => i.DeleteExpiredOlderThanAsync(It.IsAny<DateTime>(), cts.Token))
                .ReturnsAsync(0);

        await BuildSut().ExecuteAsync(cts.Token);

        _invites.Verify(i => i.DeleteExpiredOlderThanAsync(It.IsAny<DateTime>(), cts.Token), Times.Once);
    }
}
