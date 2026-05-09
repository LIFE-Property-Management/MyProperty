using Moq;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Invites.Commands.AcceptInvite;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;
using MyProperty.Tests.Unit.Handlers.TestUtils;

namespace MyProperty.Tests.Unit.Handlers.Invites;

public sealed class AcceptInviteHandlerTests
{
    private readonly Mock<IInviteRepository> _invites = new(MockBehavior.Strict);
    private readonly Mock<ILeaseRepository> _leases = new(MockBehavior.Strict);
    private readonly Mock<IUserRepository> _users = new(MockBehavior.Strict);
    private readonly Mock<ICurrentUser> _currentUser = new();
    private readonly Mock<ILandlordDashboardCache> _cache = new(MockBehavior.Strict);

    private const string PlainToken = "valid-token-1234567890ABCDE";
    private static readonly string TokenHashHex = TokenHasher.Hash(PlainToken);

    private AcceptInviteHandler BuildSut() =>
        new(
            new AcceptInviteValidator(),
            _invites.Object,
            _leases.Object,
            _users.Object,
            _currentUser.Object,
            _cache.Object);

    private static Invite SeedInvite(
        InviteStatus status = InviteStatus.Pending,
        DateTime? expiresAt = null,
        string email = "tenant@example.com",
        Guid? landlordId = null) => new()
    {
        Id = Guid.NewGuid(),
        LandlordId = landlordId ?? Guid.NewGuid(),
        PropertyId = Guid.NewGuid(),
        Email = email,
        FirstName = "Ada",
        LastName = "Lovelace",
        TokenHash = TokenHashHex,
        Status = status,
        ExpiresAt = expiresAt ?? DateTime.UtcNow.AddDays(5),
        ProposedStartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date),
        ProposedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
        ProposedMonthlyRent = 1000m,
        Currency = "EUR",
    };

    private static User SeedTenant(string email) => new()
    {
        Id = Guid.NewGuid(),
        KeycloakSubId = "kc-tenant",
        Email = email,
        FirstName = "Ada",
        LastName = "Lovelace",
    };

    [Fact]
    public async Task Happy_path_creates_lease_marks_invite_accepted_and_invalidates_cache()
    {
        var invite = SeedInvite();
        var tenant = SeedTenant(invite.Email);

        _invites.Setup(i => i.GetByTokenHashAsync(TokenHashHex, It.IsAny<CancellationToken>()))
                .ReturnsAsync(invite);
        _currentUser.SetupGet(c => c.Principal).Returns(TestPrincipal.Authenticated(tenant.KeycloakSubId, tenant.Email));
        _users.Setup(u => u.GetOrSyncFromClaimsAsync(It.IsAny<System.Security.Claims.ClaimsPrincipal>(), It.IsAny<CancellationToken>()))
              .ReturnsAsync(tenant);

        Lease? added = null;
        _leases.Setup(l => l.AddAsync(It.IsAny<Lease>(), It.IsAny<CancellationToken>()))
               .Callback<Lease, CancellationToken>((lease, _) => added = lease)
               .Returns(Task.CompletedTask);

        _invites.Setup(i => i.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
        _cache.Setup(c => c.InvalidateAsync(invite.LandlordId, It.IsAny<CancellationToken>()))
              .Returns(Task.CompletedTask);

        var sut = BuildSut();

        var result = await sut.Handle(new AcceptInviteCommand(PlainToken), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.InviteId);
        Assert.Equal(invite.Id, result.InviteId);
        Assert.NotNull(added);
        Assert.Equal(LeaseStatus.Active, added!.Status);
        Assert.Equal(invite.LandlordId, added.LandlordId);
        Assert.Equal(invite.PropertyId, added.PropertyId);
        Assert.Equal(tenant.Id, added.TenantId);
        Assert.Equal(invite.ProposedMonthlyRent, added.MonthlyRent);
        Assert.Equal(invite.Currency, added.Currency);

        Assert.Equal(InviteStatus.Accepted, invite.Status);
        Assert.NotNull(invite.AcceptedAt);

        _cache.Verify(c => c.InvalidateAsync(invite.LandlordId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Email_match_is_case_insensitive()
    {
        var invite = SeedInvite(email: "Tenant@Example.com");
        var tenant = SeedTenant("tenant@example.COM");

        _invites.Setup(i => i.GetByTokenHashAsync(TokenHashHex, It.IsAny<CancellationToken>()))
                .ReturnsAsync(invite);
        _currentUser.SetupGet(c => c.Principal).Returns(TestPrincipal.Authenticated(tenant.KeycloakSubId, tenant.Email));
        _users.Setup(u => u.GetOrSyncFromClaimsAsync(It.IsAny<System.Security.Claims.ClaimsPrincipal>(), It.IsAny<CancellationToken>()))
              .ReturnsAsync(tenant);
        _leases.Setup(l => l.AddAsync(It.IsAny<Lease>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _invites.Setup(i => i.SaveChangesAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        _cache.Setup(c => c.InvalidateAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        var sut = BuildSut();
        var result = await sut.Handle(new AcceptInviteCommand(PlainToken), CancellationToken.None);
        Assert.Equal(invite.Id, result.InviteId);
    }

    [Fact]
    public async Task Throws_NotFound_when_invite_does_not_exist()
    {
        _invites.Setup(i => i.GetByTokenHashAsync(TokenHashHex, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Invite?)null);

        var sut = BuildSut();

        await Assert.ThrowsAsync<NotFoundException>(
            () => sut.Handle(new AcceptInviteCommand(PlainToken), CancellationToken.None));
    }

    [Theory]
    [InlineData(InviteStatus.Accepted)]
    [InlineData(InviteStatus.Rejected)]
    [InlineData(InviteStatus.Expired)]
    public async Task Throws_NotFound_for_non_pending_invite(InviteStatus status)
    {
        var invite = SeedInvite(status: status);
        _invites.Setup(i => i.GetByTokenHashAsync(TokenHashHex, It.IsAny<CancellationToken>()))
                .ReturnsAsync(invite);

        var sut = BuildSut();

        await Assert.ThrowsAsync<NotFoundException>(
            () => sut.Handle(new AcceptInviteCommand(PlainToken), CancellationToken.None));

        _leases.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Throws_NotFound_for_expired_invite()
    {
        var invite = SeedInvite(expiresAt: DateTime.UtcNow.AddSeconds(-1));
        _invites.Setup(i => i.GetByTokenHashAsync(TokenHashHex, It.IsAny<CancellationToken>()))
                .ReturnsAsync(invite);

        var sut = BuildSut();

        await Assert.ThrowsAsync<NotFoundException>(
            () => sut.Handle(new AcceptInviteCommand(PlainToken), CancellationToken.None));

        _leases.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Throws_Forbidden_when_emails_differ()
    {
        var invite = SeedInvite(email: "intended@example.com");
        var someoneElse = SeedTenant("imposter@example.com");

        _invites.Setup(i => i.GetByTokenHashAsync(TokenHashHex, It.IsAny<CancellationToken>()))
                .ReturnsAsync(invite);
        _currentUser.SetupGet(c => c.Principal).Returns(TestPrincipal.Authenticated(someoneElse.KeycloakSubId, someoneElse.Email));
        _users.Setup(u => u.GetOrSyncFromClaimsAsync(It.IsAny<System.Security.Claims.ClaimsPrincipal>(), It.IsAny<CancellationToken>()))
              .ReturnsAsync(someoneElse);

        var sut = BuildSut();

        var ex = await Assert.ThrowsAsync<ForbiddenException>(
            () => sut.Handle(new AcceptInviteCommand(PlainToken), CancellationToken.None));
        Assert.Contains("different email", ex.Message, StringComparison.OrdinalIgnoreCase);

        _leases.VerifyNoOtherCalls();
        _cache.VerifyNoOtherCalls();
    }
}
