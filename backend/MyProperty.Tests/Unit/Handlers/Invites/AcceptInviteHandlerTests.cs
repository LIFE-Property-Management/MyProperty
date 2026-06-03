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
    private readonly Mock<IUserAccountProvisioner> _provisioner = new(MockBehavior.Strict);
    private readonly Mock<ILandlordDashboardCache> _cache = new(MockBehavior.Strict);

    private const string PlainToken = "valid-token-1234567890ABCDE";
    private static readonly string TokenHashHex = TokenHasher.Hash(PlainToken);

    private static AcceptInviteCommand ValidCommand(string token = PlainToken) =>
        new(token, "Ada", "Lovelace", null, "Password1");

    private AcceptInviteHandler BuildSut() =>
        new(
            new AcceptInviteValidator(),
            _invites.Object,
            _leases.Object,
            _users.Object,
            _provisioner.Object,
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

    [Fact]
    public async Task Happy_path_creates_keycloak_user_row_lease_and_invalidates_cache()
    {
        const string keycloakSub = "kc-new-tenant-sub";
        var invite = SeedInvite();

        _invites.Setup(i => i.GetByTokenHashAsync(TokenHashHex, It.IsAny<CancellationToken>()))
                .ReturnsAsync(invite);
        _users.Setup(u => u.GetByEmailAsync(invite.Email, It.IsAny<CancellationToken>()))
              .ReturnsAsync((User?)null);
        _provisioner.Setup(p => p.CreateAsync(It.IsAny<ProvisionUserRequest>(), It.IsAny<CancellationToken>()))
                    .ReturnsAsync(keycloakSub);

        User? addedUser = null;
        _users.Setup(u => u.AddAsync(It.IsAny<User>(), It.IsAny<CancellationToken>()))
              .Callback<User, CancellationToken>((u, _) => addedUser = u)
              .Returns(Task.CompletedTask);

        Lease? addedLease = null;
        _leases.Setup(l => l.AddAsync(It.IsAny<Lease>(), It.IsAny<CancellationToken>()))
               .Callback<Lease, CancellationToken>((l, _) => addedLease = l)
               .Returns(Task.CompletedTask);

        _invites.Setup(i => i.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
        _cache.Setup(c => c.InvalidateAsync(invite.LandlordId, It.IsAny<CancellationToken>()))
              .Returns(Task.CompletedTask);

        var result = await BuildSut().Handle(ValidCommand(), CancellationToken.None);

        Assert.Equal(invite.Id, result.InviteId);
        Assert.NotEqual(Guid.Empty, result.LeaseId);

        // User row created with correct fields
        Assert.NotNull(addedUser);
        Assert.Equal(keycloakSub, addedUser!.KeycloakSubId);
        Assert.Equal(invite.Email, addedUser.Email);
        Assert.Equal(TenantAccountStatus.Active, addedUser.AccountStatus);

        // Lease created with correct foreign keys
        Assert.NotNull(addedLease);
        Assert.Equal(invite.LandlordId, addedLease!.LandlordId);
        Assert.Equal(invite.PropertyId, addedLease.PropertyId);
        Assert.Equal(LeaseStatus.Active, addedLease.Status);
        Assert.Equal(invite.ProposedMonthlyRent, addedLease.MonthlyRent);

        Assert.Equal(InviteStatus.Accepted, invite.Status);
        Assert.NotNull(invite.AcceptedAt);

        // Provisioner called with Tenant role
        _provisioner.Verify(p => p.CreateAsync(
            It.Is<ProvisionUserRequest>(r =>
                r.Email == invite.Email &&
                r.RealmRole == "Tenant"),
            It.IsAny<CancellationToken>()), Times.Once);

        _cache.Verify(c => c.InvalidateAsync(invite.LandlordId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Throws_NotFound_when_invite_does_not_exist()
    {
        _invites.Setup(i => i.GetByTokenHashAsync(TokenHashHex, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Invite?)null);

        await Assert.ThrowsAsync<NotFoundException>(
            () => BuildSut().Handle(ValidCommand(), CancellationToken.None));
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

        await Assert.ThrowsAsync<NotFoundException>(
            () => BuildSut().Handle(ValidCommand(), CancellationToken.None));

        _leases.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Throws_NotFound_for_expired_invite()
    {
        var invite = SeedInvite(expiresAt: DateTime.UtcNow.AddSeconds(-1));
        _invites.Setup(i => i.GetByTokenHashAsync(TokenHashHex, It.IsAny<CancellationToken>()))
                .ReturnsAsync(invite);

        await Assert.ThrowsAsync<NotFoundException>(
            () => BuildSut().Handle(ValidCommand(), CancellationToken.None));

        _leases.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Throws_Conflict_when_email_already_has_an_account()
    {
        var invite = SeedInvite(email: "already@example.com");
        var existingUser = new User
        {
            Id = Guid.NewGuid(),
            KeycloakSubId = "existing-kc-sub",
            Email = "already@example.com",
            FirstName = "Existing",
            LastName = "User",
        };

        _invites.Setup(i => i.GetByTokenHashAsync(TokenHashHex, It.IsAny<CancellationToken>()))
                .ReturnsAsync(invite);
        _users.Setup(u => u.GetByEmailAsync(invite.Email, It.IsAny<CancellationToken>()))
              .ReturnsAsync(existingUser);

        var ex = await Assert.ThrowsAsync<ConflictException>(
            () => BuildSut().Handle(ValidCommand(), CancellationToken.None));
        Assert.Contains("already exists", ex.Message, StringComparison.OrdinalIgnoreCase);

        _provisioner.VerifyNoOtherCalls();
        _leases.VerifyNoOtherCalls();
        _cache.VerifyNoOtherCalls();
    }
}
