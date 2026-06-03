using Moq;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Payments.Queries.DownloadReceipt;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;

namespace MyProperty.Tests.Unit.Handlers.Payments;

public sealed class DownloadReceiptHandlerTests
{
    private readonly Mock<ICurrentUser> _currentUser = new();
    private readonly Mock<IUserRepository> _users = new(MockBehavior.Strict);
    private readonly Mock<IPaymentRepository> _payments = new(MockBehavior.Strict);
    private readonly Mock<IFileStorage> _files = new(MockBehavior.Strict);

    private const string UserSub = "kc-user-sub";

    private DownloadReceiptHandler BuildSut() =>
        new(_currentUser.Object, _users.Object, _payments.Object, _files.Object);

    private static User SeedUser(Guid id) => new()
    {
        Id = id,
        KeycloakSubId = UserSub,
        Email = "user@example.com",
        FirstName = "User",
        LastName = "One",
    };

    private static Payment SeedPayment(
        Guid tenantId,
        Guid landlordId,
        string? receiptFileKey = "receipts/2026/06/abc.png",
        string? receiptFileName = "receipt.png",
        string? receiptContentType = "image/png") => new()
        {
            Id = Guid.NewGuid(),
            LeaseId = Guid.NewGuid(),
            Amount = 1000m,
            Currency = "EUR",
            DueDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(30),
            Status = PaymentStatus.Pending,
            ReceiptFileKey = receiptFileKey,
            ReceiptFileName = receiptFileName,
            ReceiptContentType = receiptContentType,
            Lease = new Lease
            {
                Id = Guid.NewGuid(),
                LandlordId = landlordId,
                PropertyId = Guid.NewGuid(),
                TenantId = tenantId,
                StartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date),
                EndDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
                MonthlyRent = 1000m,
                Currency = "EUR",
            },
        };

    [Fact]
    public async Task Tenant_on_lease_can_download_receipt()
    {
        var user = SeedUser(Guid.NewGuid());
        var payment = SeedPayment(tenantId: user.Id, landlordId: Guid.NewGuid());
        var stream = new MemoryStream([1, 2, 3]);

        _currentUser.SetupGet(c => c.KeycloakSubId).Returns(UserSub);
        _users.Setup(u => u.GetByKeycloakSubIdAsync(UserSub, It.IsAny<CancellationToken>()))
              .ReturnsAsync(user);
        _payments.Setup(p => p.GetByIdWithLeaseAsync(payment.Id, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(payment);
        _files.Setup(f => f.DownloadAsync(payment.ReceiptFileKey!, It.IsAny<CancellationToken>()))
              .ReturnsAsync(stream);

        var result = await BuildSut().Handle(payment.Id, CancellationToken.None);

        Assert.Same(stream, result.Content);
        Assert.Equal("receipt.png", result.FileName);
        Assert.Equal("image/png", result.ContentType);
    }

    [Fact]
    public async Task Landlord_that_owns_lease_can_download_receipt()
    {
        var user = SeedUser(Guid.NewGuid());
        var payment = SeedPayment(tenantId: Guid.NewGuid(), landlordId: user.Id);
        var stream = new MemoryStream([1, 2, 3]);

        _currentUser.SetupGet(c => c.KeycloakSubId).Returns(UserSub);
        _users.Setup(u => u.GetByKeycloakSubIdAsync(UserSub, It.IsAny<CancellationToken>()))
              .ReturnsAsync(user);
        _payments.Setup(p => p.GetByIdWithLeaseAsync(payment.Id, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(payment);
        _files.Setup(f => f.DownloadAsync(payment.ReceiptFileKey!, It.IsAny<CancellationToken>()))
              .ReturnsAsync(stream);

        var result = await BuildSut().Handle(payment.Id, CancellationToken.None);

        Assert.Same(stream, result.Content);
    }

    [Fact]
    public async Task Falls_back_to_defaults_when_filename_and_content_type_missing()
    {
        var user = SeedUser(Guid.NewGuid());
        var payment = SeedPayment(
            tenantId: user.Id, landlordId: Guid.NewGuid(),
            receiptFileName: null, receiptContentType: null);
        var stream = new MemoryStream([1, 2, 3]);

        _currentUser.SetupGet(c => c.KeycloakSubId).Returns(UserSub);
        _users.Setup(u => u.GetByKeycloakSubIdAsync(UserSub, It.IsAny<CancellationToken>()))
              .ReturnsAsync(user);
        _payments.Setup(p => p.GetByIdWithLeaseAsync(payment.Id, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(payment);
        _files.Setup(f => f.DownloadAsync(payment.ReceiptFileKey!, It.IsAny<CancellationToken>()))
              .ReturnsAsync(stream);

        var result = await BuildSut().Handle(payment.Id, CancellationToken.None);

        Assert.Equal("receipt", result.FileName);
        Assert.Equal("application/octet-stream", result.ContentType);
    }

    [Fact]
    public async Task Throws_Forbidden_when_unauthenticated()
    {
        _currentUser.SetupGet(c => c.KeycloakSubId).Returns((string?)null);

        await Assert.ThrowsAsync<ForbiddenException>(
            () => BuildSut().Handle(Guid.NewGuid(), CancellationToken.None));

        _users.VerifyNoOtherCalls();
        _payments.VerifyNoOtherCalls();
        _files.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Throws_Forbidden_when_user_not_in_table()
    {
        _currentUser.SetupGet(c => c.KeycloakSubId).Returns(UserSub);
        _users.Setup(u => u.GetByKeycloakSubIdAsync(UserSub, It.IsAny<CancellationToken>()))
              .ReturnsAsync((User?)null);

        await Assert.ThrowsAsync<ForbiddenException>(
            () => BuildSut().Handle(Guid.NewGuid(), CancellationToken.None));

        _payments.VerifyNoOtherCalls();
        _files.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Throws_NotFound_when_payment_does_not_exist()
    {
        var user = SeedUser(Guid.NewGuid());
        var paymentId = Guid.NewGuid();

        _currentUser.SetupGet(c => c.KeycloakSubId).Returns(UserSub);
        _users.Setup(u => u.GetByKeycloakSubIdAsync(UserSub, It.IsAny<CancellationToken>()))
              .ReturnsAsync(user);
        _payments.Setup(p => p.GetByIdWithLeaseAsync(paymentId, It.IsAny<CancellationToken>()))
                 .ReturnsAsync((Payment?)null);

        var ex = await Assert.ThrowsAsync<NotFoundException>(
            () => BuildSut().Handle(paymentId, CancellationToken.None));
        Assert.Equal("Payment", ex.Resource);

        _files.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Throws_Forbidden_when_user_is_neither_tenant_nor_landlord()
    {
        var user = SeedUser(Guid.NewGuid());
        var payment = SeedPayment(tenantId: Guid.NewGuid(), landlordId: Guid.NewGuid());

        _currentUser.SetupGet(c => c.KeycloakSubId).Returns(UserSub);
        _users.Setup(u => u.GetByKeycloakSubIdAsync(UserSub, It.IsAny<CancellationToken>()))
              .ReturnsAsync(user);
        _payments.Setup(p => p.GetByIdWithLeaseAsync(payment.Id, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(payment);

        await Assert.ThrowsAsync<ForbiddenException>(
            () => BuildSut().Handle(payment.Id, CancellationToken.None));

        _files.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Throws_NotFound_for_receipt_when_no_file_attached()
    {
        var user = SeedUser(Guid.NewGuid());
        var payment = SeedPayment(tenantId: user.Id, landlordId: Guid.NewGuid(), receiptFileKey: null);

        _currentUser.SetupGet(c => c.KeycloakSubId).Returns(UserSub);
        _users.Setup(u => u.GetByKeycloakSubIdAsync(UserSub, It.IsAny<CancellationToken>()))
              .ReturnsAsync(user);
        _payments.Setup(p => p.GetByIdWithLeaseAsync(payment.Id, It.IsAny<CancellationToken>()))
                 .ReturnsAsync(payment);

        var ex = await Assert.ThrowsAsync<NotFoundException>(
            () => BuildSut().Handle(payment.Id, CancellationToken.None));
        Assert.Equal("Receipt", ex.Resource);

        _files.VerifyNoOtherCalls();
    }
}
