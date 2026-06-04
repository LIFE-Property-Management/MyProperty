using Moq;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Payments.Commands.SubmitPayment;
using MyProperty.Application.Payments.Events;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;
using MyProperty.Tests.Integration.Fixtures;

namespace MyProperty.Tests.Unit.Handlers.Payments;

public sealed class SubmitPaymentHandlerTests
{
    private readonly Mock<ICurrentUserContext> _currentUserContext = new();
    private readonly Mock<IPaymentRepository> _payments = new(MockBehavior.Strict);
    private readonly Mock<ILandlordDashboardCache> _cache = new(MockBehavior.Strict);
    private readonly Mock<IFileStorage> _files = new(MockBehavior.Strict);
    private readonly RecordingEventPublisher _events = new();

    private SubmitPaymentHandler BuildSut() =>
        new(
            new SubmitPaymentValidator(),
            _currentUserContext.Object,
            _payments.Object,
            _cache.Object,
            _events,
            _files.Object);

    private static User SeedTenant(Guid id) => new()
    {
        Id = id,
        KeycloakSubId = "kc-tenant-sub",
        Email = "tenant@example.com",
        FirstName = "Tenant",
        LastName = "One",
    };

    private void SetupCurrentUser(User user) =>
        _currentUserContext.Setup(c => c.GetUserAsync(It.IsAny<CancellationToken>()))
                           .ReturnsAsync(user);

    private static Payment SeedPayment(
        Guid tenantId,
        PaymentStatus status = PaymentStatus.Outstanding,
        Guid? landlordId = null) => new()
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
                LandlordId = landlordId ?? Guid.NewGuid(),
                PropertyId = Guid.NewGuid(),
                TenantId = tenantId,
                StartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date),
                EndDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
                MonthlyRent = 1000m,
                Currency = "EUR",
            },
        };

    private static SubmitPaymentCommand ManualCommand(Guid paymentId, string? notes = null) =>
        new(paymentId, PaymentMethod.ManualRequest, notes, null, null, null, null);

    private static SubmitPaymentCommand ReceiptCommand(Guid paymentId) =>
        new(
            paymentId,
            PaymentMethod.ReceiptUpload,
            Notes: "Paid via bank transfer",
            // Stream.Null: a non-null stream is required, but IFileStorage.UploadAsync
            // is mocked and never reads it, so no real content (or disposal) is needed.
            FileStream: Stream.Null,
            FileName: "receipt.png",
            ContentType: "image/png",
            FileSizeBytes: 4);

    [Fact]
    public async Task Happy_path_manual_transitions_to_pending_saves_invalidates_and_publishes()
    {
        var tenant = SeedTenant(Guid.NewGuid());
        var payment = SeedPayment(tenant.Id);

        SetupCurrentUser(tenant);
        _payments.Setup(p => p.GetByIdWithLeaseAsync(payment.Id, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(payment);
        _payments.Setup(p => p.SaveChangesAsync(It.IsAny<CancellationToken>()))
                 .Returns(Task.CompletedTask);
        _cache.Setup(c => c.InvalidateAsync(payment.Lease!.LandlordId, It.IsAny<CancellationToken>()))
              .Returns(Task.CompletedTask);

        var result = await BuildSut().Handle(ManualCommand(payment.Id), CancellationToken.None);

        Assert.Equal(PaymentStatus.Pending, payment.Status);
        Assert.Equal(PaymentMethod.ManualRequest, payment.Method);
        Assert.NotNull(payment.SubmittedAt);
        Assert.Null(payment.ReceiptFileKey);
        Assert.Equal(payment.Id, result.PaymentId);

        _payments.Verify(p => p.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _cache.Verify(c => c.InvalidateAsync(payment.Lease!.LandlordId, It.IsAny<CancellationToken>()), Times.Once);
        _files.VerifyNoOtherCalls(); // no upload for manual submissions

        var evt = Assert.IsType<PaymentSubmittedEvent>(Assert.Single(_events.Events));
        Assert.Equal(payment.Id, evt.PaymentId);
        Assert.Equal(payment.Lease!.TenantId, evt.TenantId);
        Assert.Equal(payment.Lease!.LandlordId, evt.LandlordId);
        Assert.Null(evt.ReceiptFileKey);
    }

    [Fact]
    public async Task Happy_path_receipt_upload_stores_file_and_populates_event_key()
    {
        var tenant = SeedTenant(Guid.NewGuid());
        var payment = SeedPayment(tenant.Id);
        const string storageKey = "receipts/2026/06/abc.png";

        SetupCurrentUser(tenant);
        _payments.Setup(p => p.GetByIdWithLeaseAsync(payment.Id, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(payment);
        _files.Setup(f => f.UploadAsync(
                    It.IsAny<Stream>(), "receipt.png", "image/png", It.IsAny<CancellationToken>()))
              .ReturnsAsync(storageKey);
        _payments.Setup(p => p.SaveChangesAsync(It.IsAny<CancellationToken>()))
                 .Returns(Task.CompletedTask);
        _cache.Setup(c => c.InvalidateAsync(payment.Lease!.LandlordId, It.IsAny<CancellationToken>()))
              .Returns(Task.CompletedTask);

        await BuildSut().Handle(ReceiptCommand(payment.Id), CancellationToken.None);

        Assert.Equal(PaymentStatus.Pending, payment.Status);
        Assert.Equal(storageKey, payment.ReceiptFileKey);
        Assert.Equal("receipt.png", payment.ReceiptFileName);
        Assert.Equal("image/png", payment.ReceiptContentType);
        Assert.Equal(4, payment.ReceiptSizeBytes);

        _files.Verify(f => f.UploadAsync(
            It.IsAny<Stream>(), "receipt.png", "image/png", It.IsAny<CancellationToken>()), Times.Once);

        var evt = Assert.IsType<PaymentSubmittedEvent>(Assert.Single(_events.Events));
        Assert.Equal(storageKey, evt.ReceiptFileKey);
    }

    [Fact]
    public async Task Resubmit_after_rejection_clears_rejection_residue()
    {
        var tenant = SeedTenant(Guid.NewGuid());
        var payment = SeedPayment(tenant.Id, status: PaymentStatus.Rejected);
        payment.RejectionReason = "Receipt was illegible";
        payment.RejectedAt = DateTime.UtcNow.AddDays(-1);

        SetupCurrentUser(tenant);
        _payments.Setup(p => p.GetByIdWithLeaseAsync(payment.Id, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(payment);
        _payments.Setup(p => p.SaveChangesAsync(It.IsAny<CancellationToken>()))
                 .Returns(Task.CompletedTask);
        _cache.Setup(c => c.InvalidateAsync(payment.Lease!.LandlordId, It.IsAny<CancellationToken>()))
              .Returns(Task.CompletedTask);

        await BuildSut().Handle(ManualCommand(payment.Id), CancellationToken.None);

        Assert.Equal(PaymentStatus.Pending, payment.Status);
        Assert.Null(payment.RejectionReason);
        Assert.Null(payment.RejectedAt);
    }

    [Fact]
    public async Task Propagates_Forbidden_when_current_user_cannot_be_resolved()
    {
        _currentUserContext.Setup(c => c.GetUserAsync(It.IsAny<CancellationToken>()))
                           .ThrowsAsync(new ForbiddenException("Authentication required."));

        await Assert.ThrowsAsync<ForbiddenException>(
            () => BuildSut().Handle(ManualCommand(Guid.NewGuid()), CancellationToken.None));

        _payments.VerifyNoOtherCalls();
        Assert.Empty(_events.Events);
    }

    [Fact]
    public async Task Throws_NotFound_when_payment_does_not_exist()
    {
        var tenant = SeedTenant(Guid.NewGuid());
        var paymentId = Guid.NewGuid();

        SetupCurrentUser(tenant);
        _payments.Setup(p => p.GetByIdWithLeaseAsync(paymentId, It.IsAny<CancellationToken>()))
                 .ReturnsAsync((Payment?)null);

        var ex = await Assert.ThrowsAsync<NotFoundException>(
            () => BuildSut().Handle(ManualCommand(paymentId), CancellationToken.None));
        Assert.Equal("Payment", ex.Resource);
    }

    [Fact]
    public async Task Throws_Forbidden_when_payment_not_on_callers_lease()
    {
        var tenant = SeedTenant(Guid.NewGuid());
        var payment = SeedPayment(tenantId: Guid.NewGuid()); // different tenant

        SetupCurrentUser(tenant);
        _payments.Setup(p => p.GetByIdWithLeaseAsync(payment.Id, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(payment);

        await Assert.ThrowsAsync<ForbiddenException>(
            () => BuildSut().Handle(ManualCommand(payment.Id), CancellationToken.None));

        _cache.VerifyNoOtherCalls();
        Assert.Empty(_events.Events);
    }

    [Theory]
    [InlineData(PaymentStatus.Pending)]
    [InlineData(PaymentStatus.Confirmed)]
    public async Task Throws_Conflict_when_state_does_not_allow_submit(PaymentStatus status)
    {
        var tenant = SeedTenant(Guid.NewGuid());
        var payment = SeedPayment(tenant.Id, status: status);

        SetupCurrentUser(tenant);
        _payments.Setup(p => p.GetByIdWithLeaseAsync(payment.Id, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(payment);

        await Assert.ThrowsAsync<ConflictException>(
            () => BuildSut().Handle(ManualCommand(payment.Id), CancellationToken.None));

        _cache.VerifyNoOtherCalls();
        Assert.Empty(_events.Events);
    }

    [Fact]
    public async Task Throws_Validation_when_receipt_method_missing_file()
    {
        // Validation runs before user resolution; GetUserAsync is never reached.
        var cmd = new SubmitPaymentCommand(
            Guid.NewGuid(), PaymentMethod.ReceiptUpload, null, null, null, null, null);

        await Assert.ThrowsAsync<ValidationException>(
            () => BuildSut().Handle(cmd, CancellationToken.None));

        _payments.VerifyNoOtherCalls();
        _files.VerifyNoOtherCalls();
    }
}
