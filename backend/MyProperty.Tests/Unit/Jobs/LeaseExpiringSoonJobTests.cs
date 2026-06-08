using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Notifications;
using MyProperty.Domain.Entities;
using MyProperty.Infrastructure.Jobs;

namespace MyProperty.Tests.Unit.Jobs;

public sealed class LeaseExpiringSoonJobTests
{
    private readonly Mock<ILeaseRepository> _leases = new(MockBehavior.Strict);
    private readonly Mock<INotificationDispatcher> _dispatcher = new(MockBehavior.Strict);

    private LeaseExpiringSoonJob BuildSut() =>
        new(_leases.Object, _dispatcher.Object, NullLogger<LeaseExpiringSoonJob>.Instance);

    private static Lease SeedActiveLease(Guid tenantId, DateOnly endDate) => new()
    {
        Id = Guid.NewGuid(),
        LandlordId = Guid.NewGuid(),
        PropertyId = Guid.NewGuid(),
        TenantId = tenantId,
        StartDate = endDate.AddYears(-1),
        EndDate = endDate,
        MonthlyRent = 800m,
        Currency = "EUR",
    };

    [Fact]
    public async Task Does_not_dispatch_when_no_leases_are_expiring()
    {
        _leases.Setup(r => r.ListAllExpiringSoonAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
               .ReturnsAsync([]);

        await BuildSut().ExecuteAsync(CancellationToken.None);

        _dispatcher.Verify(
            d => d.NotifyTenantLeaseExpiringAsync(
                It.IsAny<Guid>(), It.IsAny<LeaseExpiringNotification>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Dispatches_one_notification_per_expiring_lease()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var endA = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(10);
        var endB = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(25);

        var leaseA = SeedActiveLease(tenantA, endA);
        var leaseB = SeedActiveLease(tenantB, endB);

        _leases.Setup(r => r.ListAllExpiringSoonAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
               .ReturnsAsync([leaseA, leaseB]);
        _dispatcher.Setup(d => d.NotifyTenantLeaseExpiringAsync(
                tenantA,
                It.Is<LeaseExpiringNotification>(n => n.LeaseId == leaseA.Id && n.ExpiresAt == endA),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _dispatcher.Setup(d => d.NotifyTenantLeaseExpiringAsync(
                tenantB,
                It.Is<LeaseExpiringNotification>(n => n.LeaseId == leaseB.Id && n.ExpiresAt == endB),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        await BuildSut().ExecuteAsync(CancellationToken.None);

        _dispatcher.Verify(
            d => d.NotifyTenantLeaseExpiringAsync(
                It.IsAny<Guid>(), It.IsAny<LeaseExpiringNotification>(), It.IsAny<CancellationToken>()),
            Times.Exactly(2));
    }

    [Fact]
    public async Task Passes_30_day_threshold_to_repository()
    {
        int capturedThreshold = -1;
        _leases.Setup(r => r.ListAllExpiringSoonAsync(It.IsAny<int>(), It.IsAny<CancellationToken>()))
               .Callback<int, CancellationToken>((days, _) => capturedThreshold = days)
               .ReturnsAsync([]);

        await BuildSut().ExecuteAsync(CancellationToken.None);

        Assert.Equal(30, capturedThreshold);
    }

    [Fact]
    public async Task Threads_cancellation_token_through_repo_and_dispatcher()
    {
        using var cts = new CancellationTokenSource();
        var tenantId = Guid.NewGuid();
        var lease = SeedActiveLease(tenantId, DateOnly.FromDateTime(DateTime.UtcNow).AddDays(5));

        _leases.Setup(r => r.ListAllExpiringSoonAsync(It.IsAny<int>(), cts.Token))
               .ReturnsAsync([lease]);
        _dispatcher.Setup(d => d.NotifyTenantLeaseExpiringAsync(
                tenantId, It.IsAny<LeaseExpiringNotification>(), cts.Token))
            .Returns(Task.CompletedTask);

        await BuildSut().ExecuteAsync(cts.Token);

        _leases.Verify(r => r.ListAllExpiringSoonAsync(It.IsAny<int>(), cts.Token), Times.Once);
        _dispatcher.Verify(
            d => d.NotifyTenantLeaseExpiringAsync(tenantId, It.IsAny<LeaseExpiringNotification>(), cts.Token),
            Times.Once);
    }
}