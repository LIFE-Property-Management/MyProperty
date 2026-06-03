using Moq;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Payments.Commands.ConfirmPayment;
using MyProperty.Application.Payments.Events;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;
using MyProperty.Tests.Integration.Fixtures;

namespace MyProperty.Tests.Unit.Handlers.Payments;

public sealed class ConfirmPaymentHandlerTests
{
    private readonly Mock<ICurrentUser> _currentUser = new();
    private readonly Mock<IUserRepository> _users = new(MockBehavior.Strict);
    private readonly Mock<IPaymentRepository> _payments = new(MockBehavior.Strict);
    private readonly Mock<ILandlordDashboardCache> _cache = new(MockBehavior.Strict);
    private readonly RecordingEventPublisher _events = new();

    private const string LandlordSub = "kc-landlord-sub";

    private ConfirmPaymentHandler BuildSut() =>
        new(
            new ConfirmPaymentValidator(),
            _currentUser.Object,
            _users.Object,
            _payments.Object,
            _cache.Object,
            _events);

    private static User SeedLandlord(Guid id) => new()
    {
        Id = id,
        KeycloakSubId = LandlordSub,
        Email = "landlord@example.com",
        FirstName = "Landlord",
        LastName = "One",
    };

    private static Payment SeedPayment(
        Guid landlordId,
        PaymentStatus status = PaymentStatus.Pending) => new()
        {
            Id = Guid.NewGuid(),
            LeaseId = Guid.NewGuid(),
            Amount = 1000m,
            Currency = "EUR",
            DueDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(30),
            Status = status,
            Lease = new Lease
            {
                Id = Guid.NewGuid(),
                LandlordId = landlordId,
                PropertyId = Guid.NewGuid(),
                TenantId = Guid.NewGuid(),
                StartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date),
                EndDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
                MonthlyRent = 1000m,
                Currency = "EUR",
            },
        };

    [Fact]
    public async Task Happy_path_transitions_to_confirmed_saves_invalidates_and_publishes()
    {
        var landlord = SeedLandlord(Guid.NewGuid());
        var payment = SeedPayment(landlord.Id);

        _currentUser.SetupGet(c => c.KeycloakSubId).Returns(LandlordSub);
        _users.Setup(u => u.GetByKeycloakSubIdAsync(LandlordSub, It.IsAny<CancellationToken>()))
              .ReturnsAsync(landlord);
        _payments.Setup(p => p.GetByIdWithLeaseAsync(payment.Id, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(payment);
        _payments.Setup(p => p.SaveChangesAsync(It.IsAny<CancellationToken>()))
                 .Returns(Task.CompletedTask);
        _cache.Setup(c => c.InvalidateAsync(payment.Lease!.LandlordId, It.IsAny<CancellationToken>()))
              .Returns(Task.CompletedTask);

        var result = await BuildSut().Handle(new ConfirmPaymentCommand(payment.Id), CancellationToken.None);

        Assert.Equal(PaymentStatus.Confirmed, payment.Status);
        Assert.NotNull(payment.ConfirmedAt);
        Assert.Equal(payment.Id, result.PaymentId);

        _payments.Verify(p => p.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _cache.Verify(c => c.InvalidateAsync(payment.Lease!.LandlordId, It.IsAny<CancellationToken>()), Times.Once);

        var evt = Assert.IsType<PaymentConfirmedEvent>(Assert.Single(_events.Events));
        Assert.Equal(payment.Id, evt.PaymentId);
        Assert.Equal(payment.Lease!.TenantId, evt.TenantId);
        Assert.Equal(payment.Lease!.LandlordId, evt.LandlordId);
    }

    [Fact]
    public async Task Throws_Forbidden_when_unauthenticated()
    {
        _currentUser.SetupGet(c => c.KeycloakSubId).Returns((string?)null);

        await Assert.ThrowsAsync<ForbiddenException>(
            () => BuildSut().Handle(new ConfirmPaymentCommand(Guid.NewGuid()), CancellationToken.None));

        _users.VerifyNoOtherCalls();
        _payments.VerifyNoOtherCalls();
        Assert.Empty(_events.Events);
    }

    [Fact]
    public async Task Throws_Forbidden_when_user_not_in_table()
    {
        _currentUser.SetupGet(c => c.KeycloakSubId).Returns(LandlordSub);
        _users.Setup(u => u.GetByKeycloakSubIdAsync(LandlordSub, It.IsAny<CancellationToken>()))
              .ReturnsAsync((User?)null);

        await Assert.ThrowsAsync<ForbiddenException>(
            () => BuildSut().Handle(new ConfirmPaymentCommand(Guid.NewGuid()), CancellationToken.None));

        _payments.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Throws_NotFound_when_payment_does_not_exist()
    {
        var landlord = SeedLandlord(Guid.NewGuid());
        var paymentId = Guid.NewGuid();

        _currentUser.SetupGet(c => c.KeycloakSubId).Returns(LandlordSub);
        _users.Setup(u => u.GetByKeycloakSubIdAsync(LandlordSub, It.IsAny<CancellationToken>()))
              .ReturnsAsync(landlord);
        _payments.Setup(p => p.GetByIdWithLeaseAsync(paymentId, It.IsAny<CancellationToken>()))
                 .ReturnsAsync((Payment?)null);

        var ex = await Assert.ThrowsAsync<NotFoundException>(
            () => BuildSut().Handle(new ConfirmPaymentCommand(paymentId), CancellationToken.None));
        Assert.Equal("Payment", ex.Resource);
    }

    [Fact]
    public async Task Throws_Forbidden_when_payment_owned_by_another_landlord()
    {
        var landlord = SeedLandlord(Guid.NewGuid());
        var payment = SeedPayment(landlordId: Guid.NewGuid()); // different owner

        _currentUser.SetupGet(c => c.KeycloakSubId).Returns(LandlordSub);
        _users.Setup(u => u.GetByKeycloakSubIdAsync(LandlordSub, It.IsAny<CancellationToken>()))
              .ReturnsAsync(landlord);
        _payments.Setup(p => p.GetByIdWithLeaseAsync(payment.Id, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(payment);

        await Assert.ThrowsAsync<ForbiddenException>(
            () => BuildSut().Handle(new ConfirmPaymentCommand(payment.Id), CancellationToken.None));

        _cache.VerifyNoOtherCalls();
        Assert.Empty(_events.Events);
    }

    [Theory]
    [InlineData(PaymentStatus.Outstanding)]
    [InlineData(PaymentStatus.Confirmed)]
    [InlineData(PaymentStatus.Rejected)]
    public async Task Throws_Conflict_when_state_is_not_pending(PaymentStatus status)
    {
        var landlord = SeedLandlord(Guid.NewGuid());
        var payment = SeedPayment(landlord.Id, status: status);

        _currentUser.SetupGet(c => c.KeycloakSubId).Returns(LandlordSub);
        _users.Setup(u => u.GetByKeycloakSubIdAsync(LandlordSub, It.IsAny<CancellationToken>()))
              .ReturnsAsync(landlord);
        _payments.Setup(p => p.GetByIdWithLeaseAsync(payment.Id, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(payment);

        await Assert.ThrowsAsync<ConflictException>(
            () => BuildSut().Handle(new ConfirmPaymentCommand(payment.Id), CancellationToken.None));

        _cache.VerifyNoOtherCalls();
        Assert.Empty(_events.Events);
    }

    [Fact]
    public async Task Throws_Validation_when_payment_id_empty()
    {
        _currentUser.SetupGet(c => c.KeycloakSubId).Returns(LandlordSub);

        await Assert.ThrowsAsync<ValidationException>(
            () => BuildSut().Handle(new ConfirmPaymentCommand(Guid.Empty), CancellationToken.None));

        _users.VerifyNoOtherCalls();
        _payments.VerifyNoOtherCalls();
    }
}
