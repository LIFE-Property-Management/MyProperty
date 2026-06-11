using Moq;
using MyProperty.Application.Common.Email;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Leases.Commands.CancelOwnLease;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;
using MyProperty.Domain.Exceptions;

namespace MyProperty.Tests.Unit.Handlers.Leases;

public sealed class CancelOwnLeaseHandlerTests
{
    private readonly Mock<ILeaseRepository> _leases = new(MockBehavior.Strict);
    private readonly Mock<ICurrentUserContext> _currentUserContext = new();
    private readonly Mock<IBackgroundJobQueue> _jobs = new(MockBehavior.Strict);
    private readonly Mock<ILandlordDashboardCache> _dashboardCache = new();

    private CancelOwnLeaseHandler BuildSut() =>
        new(_leases.Object, _currentUserContext.Object, _jobs.Object, _dashboardCache.Object);

    private static User SeedTenant(Guid id) => new()
    {
        Id = id,
        KeycloakSubId = "kc-tenant",
        Email = "tenant@example.com",
        FirstName = "Ada",
        LastName = "Lovelace",
    };

    private static Lease SeedActiveLease(Guid tenantId, Guid landlordId) => new()
    {
        Id = Guid.NewGuid(),
        LandlordId = landlordId,
        Landlord = new User
        {
            Id = landlordId,
            KeycloakSubId = "kc-landlord",
            Email = "landlord@example.com",
            FirstName = "Larry",
            LastName = "Lord",
        },
        PropertyId = Guid.NewGuid(),
        Property = new Property
        {
            Id = Guid.NewGuid(),
            LandlordId = landlordId,
            Name = "Sunset Apt",
            Address = "1 Sunset Blvd",
        },
        TenantId = tenantId,
        StartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date),
        EndDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
        MonthlyRent = 1000m,
        Currency = "EUR",
    };

    private void SetupCurrentUser(User tenant) =>
        _currentUserContext.Setup(c => c.GetOrSyncUserAsync(It.IsAny<CancellationToken>()))
                           .ReturnsAsync(tenant);

    [Fact]
    public async Task Happy_path_terminates_lease_and_enqueues_landlord_email()
    {
        var tenant = SeedTenant(Guid.NewGuid());
        var landlordId = Guid.NewGuid();
        var lease = SeedActiveLease(tenant.Id, landlordId);

        SetupCurrentUser(tenant);
        _leases.Setup(l => l.GetActiveByTenantIdAsync(tenant.Id, It.IsAny<CancellationToken>()))
               .ReturnsAsync(lease);
        _leases.Setup(l => l.SaveChangesAsync(It.IsAny<CancellationToken>()))
               .Returns(Task.CompletedTask);

        EmailMessage? enqueued = null;
        _jobs.Setup(j => j.EnqueueEmail(It.IsAny<EmailMessage>()))
             .Callback<EmailMessage>(m => enqueued = m)
             .Returns("job-id");

        var sut = BuildSut();

        await sut.Handle(new CancelOwnLeaseCommand(), CancellationToken.None);

        Assert.Equal(LeaseStatus.Terminated, lease.Status);
        _leases.Verify(l => l.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);

        Assert.NotNull(enqueued);
        Assert.Equal("landlord@example.com", enqueued!.To);
        Assert.Contains("Ada Lovelace", enqueued.Subject);
        Assert.Contains("Sunset Apt", enqueued.Subject);
        Assert.Contains("Sunset Apt", enqueued.Body);
        Assert.True(enqueued.IsHtml);

        _dashboardCache.Verify(c => c.InvalidateAsync(landlordId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Throws_NotFound_when_no_active_lease()
    {
        var tenant = SeedTenant(Guid.NewGuid());

        SetupCurrentUser(tenant);
        _leases.Setup(l => l.GetActiveByTenantIdAsync(tenant.Id, It.IsAny<CancellationToken>()))
               .ReturnsAsync((Lease?)null);

        var sut = BuildSut();

        await Assert.ThrowsAsync<NotFoundException>(
            () => sut.Handle(new CancelOwnLeaseCommand(), CancellationToken.None));

        _jobs.Verify(j => j.EnqueueEmail(It.IsAny<EmailMessage>()), Times.Never);
        _dashboardCache.Verify(c => c.InvalidateAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Throws_LeaseAlreadyTerminated_when_lease_already_terminated()
    {
        var tenant = SeedTenant(Guid.NewGuid());
        var lease = SeedActiveLease(tenant.Id, Guid.NewGuid());
        // Simulates a concurrent cancel: the lease was loaded as active but got
        // terminated before this handler's Terminate() call. The domain guard
        // throws, and GlobalExceptionHandler maps it to 409 (see Step 3).
        lease.Terminate();

        SetupCurrentUser(tenant);
        _leases.Setup(l => l.GetActiveByTenantIdAsync(tenant.Id, It.IsAny<CancellationToken>()))
               .ReturnsAsync(lease);

        var sut = BuildSut();

        await Assert.ThrowsAsync<LeaseAlreadyTerminatedException>(
            () => sut.Handle(new CancelOwnLeaseCommand(), CancellationToken.None));

        _leases.Verify(l => l.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        _jobs.Verify(j => j.EnqueueEmail(It.IsAny<EmailMessage>()), Times.Never);
    }
}
