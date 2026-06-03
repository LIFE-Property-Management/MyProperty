using Moq;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Payments.Commands.RejectPayment;
using MyProperty.Application.Payments.Events;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;
using MyProperty.Tests.Integration.Fixtures;

namespace MyProperty.Tests.Unit.Handlers.Payments;

public sealed class RejectPaymentHandlerTests
{
    private readonly Mock<ICurrentUserContext> _currentUserContext = new();
    private readonly Mock<IPaymentRepository> _payments = new(MockBehavior.Strict);
    private readonly Mock<ILandlordDashboardCache> _cache = new(MockBehavior.Strict);
    private readonly RecordingEventPublisher _events = new();

    private const string ValidReason = "Receipt amount does not match the rent due.";

    private RejectPaymentHandler BuildSut() =>
        new(
            new RejectPaymentValidator(),
            _currentUserContext.Object,
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

    private void SetupCurrentUser(User user) =>
        _currentUserContext.Setup(c => c.GetUserAsync(It.IsAny<CancellationToken>()))
                           .ReturnsAsync(user);

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
    public async Task Happy_path_transitions_to_rejected_trims_reason_saves_and_publishes()
    {
        var landlord = SeedLandlord(Guid.NewGuid());
        var payment = SeedPayment(landlord.Id);

        SetupCurrentUser(landlord);
        _payments.Setup(p => p.GetByIdWithLeaseAsync(payment.Id, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(payment);
        _payments.Setup(p => p.SaveChangesAsync(It.IsAny<CancellationToken>()))
                 .Returns(Task.CompletedTask);
        _cache.Setup(c => c.InvalidateAsync(payment.Lease!.LandlordId, It.IsAny<CancellationToken>()))
              .Returns(Task.CompletedTask);

        var result = await BuildSut().Handle(
            new RejectPaymentCommand(payment.Id, $"  {ValidReason}  "), CancellationToken.None);

        Assert.Equal(PaymentStatus.Rejected, payment.Status);
        Assert.NotNull(payment.RejectedAt);
        Assert.Equal(ValidReason, payment.RejectionReason); // trimmed
        Assert.Equal(payment.Id, result.PaymentId);

        _payments.Verify(p => p.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _cache.Verify(c => c.InvalidateAsync(payment.Lease!.LandlordId, It.IsAny<CancellationToken>()), Times.Once);

        var evt = Assert.IsType<PaymentRejectedEvent>(Assert.Single(_events.Events));
        Assert.Equal(payment.Id, evt.PaymentId);
        Assert.Equal(ValidReason, evt.Reason);
        Assert.Equal(payment.Lease!.TenantId, evt.TenantId);
    }

    [Fact]
    public async Task Propagates_Forbidden_when_current_user_cannot_be_resolved()
    {
        _currentUserContext.Setup(c => c.GetUserAsync(It.IsAny<CancellationToken>()))
                           .ThrowsAsync(new ForbiddenException("Authentication required."));

        await Assert.ThrowsAsync<ForbiddenException>(
            () => BuildSut().Handle(new RejectPaymentCommand(Guid.NewGuid(), ValidReason), CancellationToken.None));

        _payments.VerifyNoOtherCalls();
        Assert.Empty(_events.Events);
    }

    [Fact]
    public async Task Throws_NotFound_when_payment_does_not_exist()
    {
        var landlord = SeedLandlord(Guid.NewGuid());
        var paymentId = Guid.NewGuid();

        SetupCurrentUser(landlord);
        _payments.Setup(p => p.GetByIdWithLeaseAsync(paymentId, It.IsAny<CancellationToken>()))
                 .ReturnsAsync((Payment?)null);

        var ex = await Assert.ThrowsAsync<NotFoundException>(
            () => BuildSut().Handle(new RejectPaymentCommand(paymentId, ValidReason), CancellationToken.None));
        Assert.Equal("Payment", ex.Resource);
    }

    [Fact]
    public async Task Throws_Forbidden_when_payment_owned_by_another_landlord()
    {
        var landlord = SeedLandlord(Guid.NewGuid());
        var payment = SeedPayment(landlordId: Guid.NewGuid()); // different owner

        SetupCurrentUser(landlord);
        _payments.Setup(p => p.GetByIdWithLeaseAsync(payment.Id, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(payment);

        await Assert.ThrowsAsync<ForbiddenException>(
            () => BuildSut().Handle(new RejectPaymentCommand(payment.Id, ValidReason), CancellationToken.None));

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

        SetupCurrentUser(landlord);
        _payments.Setup(p => p.GetByIdWithLeaseAsync(payment.Id, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(payment);

        await Assert.ThrowsAsync<ConflictException>(
            () => BuildSut().Handle(new RejectPaymentCommand(payment.Id, ValidReason), CancellationToken.None));

        _cache.VerifyNoOtherCalls();
        Assert.Empty(_events.Events);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("too short")] // under 10 chars
    public async Task Throws_Validation_for_invalid_reason(string reason)
    {
        // Validation runs before user resolution; GetUserAsync is never reached.
        await Assert.ThrowsAsync<ValidationException>(
            () => BuildSut().Handle(new RejectPaymentCommand(Guid.NewGuid(), reason), CancellationToken.None));

        _payments.VerifyNoOtherCalls();
    }
}
