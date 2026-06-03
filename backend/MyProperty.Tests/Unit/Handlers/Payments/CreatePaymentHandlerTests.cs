using Moq;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Payments.Commands.CreatePayment;
using MyProperty.Application.Payments.Events;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;
using MyProperty.Tests.Integration.Fixtures;

namespace MyProperty.Tests.Unit.Handlers.Payments;

public sealed class CreatePaymentHandlerTests
{
    private readonly Mock<ICurrentUserContext> _currentUserContext = new();
    private readonly Mock<ILeaseRepository> _leases = new(MockBehavior.Strict);
    private readonly Mock<IPaymentRepository> _payments = new(MockBehavior.Strict);
    private readonly Mock<ILandlordDashboardCache> _cache = new(MockBehavior.Strict);
    private readonly RecordingEventPublisher _events = new();

    private CreatePaymentHandler BuildSut() =>
        new(
            new CreatePaymentValidator(),
            _currentUserContext.Object,
            _leases.Object,
            _payments.Object,
            _cache.Object,
            _events);

    private static User SeedLandlord(Guid id) => new()
    {
        Id = id,
        KeycloakSubId = "kc-landlord-sub",
        Email = "landlord@example.com",
        FirstName = "Landlord",
        LastName = "One",
    };

    private static Lease SeedLease(Guid landlordId, Guid? tenantId = null) => new()
    {
        Id = Guid.NewGuid(),
        LandlordId = landlordId,
        PropertyId = Guid.NewGuid(),
        TenantId = tenantId ?? Guid.NewGuid(),
        StartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date),
        EndDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
        MonthlyRent = 1000m,
        Currency = "EUR",
    };

    private void SetupCurrentUser(User user) =>
        _currentUserContext.Setup(c => c.GetUserAsync(It.IsAny<CancellationToken>()))
                           .ReturnsAsync(user);

    private static CreatePaymentCommand ValidCommand(Guid leaseId, decimal amount = 1000m, string currency = "EUR") =>
        new(leaseId, amount, currency, DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(30));

    [Fact]
    public async Task Happy_path_creates_outstanding_payment_saves_invalidates_cache_and_publishes_event()
    {
        var landlord = SeedLandlord(Guid.NewGuid());
        var lease = SeedLease(landlord.Id);

        SetupCurrentUser(landlord);
        _leases.Setup(l => l.GetByIdAsync(lease.Id, It.IsAny<CancellationToken>()))
               .ReturnsAsync(lease);

        Payment? added = null;
        _payments.Setup(p => p.AddAsync(It.IsAny<Payment>(), It.IsAny<CancellationToken>()))
                 .Callback<Payment, CancellationToken>((p, _) => { p.Id = Guid.NewGuid(); added = p; })
                 .Returns(Task.CompletedTask);
        _payments.Setup(p => p.SaveChangesAsync(It.IsAny<CancellationToken>()))
                 .Returns(Task.CompletedTask);
        _cache.Setup(c => c.InvalidateAsync(landlord.Id, It.IsAny<CancellationToken>()))
              .Returns(Task.CompletedTask);

        var result = await BuildSut().Handle(ValidCommand(lease.Id, 1500m, "USD"), CancellationToken.None);

        Assert.NotNull(added);
        Assert.Equal(PaymentStatus.Outstanding, added!.Status);
        Assert.Equal(lease.Id, added.LeaseId);
        Assert.Equal(1500m, added.Amount);
        Assert.Equal("USD", added.Currency);
        Assert.Equal(added.Id, result.PaymentId);

        _payments.Verify(p => p.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _cache.Verify(c => c.InvalidateAsync(landlord.Id, It.IsAny<CancellationToken>()), Times.Once);

        var evt = Assert.IsType<PaymentCreatedEvent>(Assert.Single(_events.Events));
        Assert.Equal(added.Id, evt.PaymentId);
        Assert.Equal(lease.Id, evt.LeaseId);
        Assert.Equal(lease.TenantId, evt.TenantId);
        Assert.Equal(lease.LandlordId, evt.LandlordId);
        Assert.Equal(1500m, evt.Amount);
        Assert.Equal("USD", evt.Currency);
    }

    [Fact]
    public async Task Propagates_Forbidden_when_current_user_cannot_be_resolved()
    {
        // Unauthenticated / not-in-table both surface from ICurrentUserContext now
        // (covered directly by CurrentUserContextTests); the handler just propagates.
        _currentUserContext.Setup(c => c.GetUserAsync(It.IsAny<CancellationToken>()))
                           .ThrowsAsync(new ForbiddenException("Authentication required."));

        await Assert.ThrowsAsync<ForbiddenException>(
            () => BuildSut().Handle(ValidCommand(Guid.NewGuid()), CancellationToken.None));

        _leases.VerifyNoOtherCalls();
        _payments.VerifyNoOtherCalls();
        Assert.Empty(_events.Events);
    }

    [Fact]
    public async Task Throws_NotFound_when_lease_does_not_exist()
    {
        var landlord = SeedLandlord(Guid.NewGuid());
        var leaseId = Guid.NewGuid();

        SetupCurrentUser(landlord);
        _leases.Setup(l => l.GetByIdAsync(leaseId, It.IsAny<CancellationToken>()))
               .ReturnsAsync((Lease?)null);

        var ex = await Assert.ThrowsAsync<NotFoundException>(
            () => BuildSut().Handle(ValidCommand(leaseId), CancellationToken.None));
        Assert.Equal("Lease", ex.Resource);

        _payments.VerifyNoOtherCalls();
        Assert.Empty(_events.Events);
    }

    [Fact]
    public async Task Throws_Forbidden_when_lease_owned_by_another_landlord()
    {
        var landlord = SeedLandlord(Guid.NewGuid());
        var lease = SeedLease(landlordId: Guid.NewGuid()); // different owner

        SetupCurrentUser(landlord);
        _leases.Setup(l => l.GetByIdAsync(lease.Id, It.IsAny<CancellationToken>()))
               .ReturnsAsync(lease);

        await Assert.ThrowsAsync<ForbiddenException>(
            () => BuildSut().Handle(ValidCommand(lease.Id), CancellationToken.None));

        _payments.VerifyNoOtherCalls();
        _cache.VerifyNoOtherCalls();
        Assert.Empty(_events.Events);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(1_000_000)]
    public async Task Throws_Validation_for_out_of_range_amount(decimal amount)
    {
        // Validation runs before user resolution, so GetUserAsync is never reached.
        await Assert.ThrowsAsync<ValidationException>(
            () => BuildSut().Handle(ValidCommand(Guid.NewGuid(), amount), CancellationToken.None));

        _leases.VerifyNoOtherCalls();
        _payments.VerifyNoOtherCalls();
    }
}
