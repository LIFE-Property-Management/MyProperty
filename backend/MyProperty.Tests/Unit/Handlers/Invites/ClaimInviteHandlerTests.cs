using Moq;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Messaging;
using MyProperty.Application.Invites;
using MyProperty.Application.Invites.Commands.ClaimInvite;
using MyProperty.Application.Invites.Events;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;

namespace MyProperty.Tests.Unit.Handlers.Invites;

public sealed class ClaimInviteHandlerTests
{
    private readonly Mock<IInviteRepository> _invites = new(MockBehavior.Strict);
    private readonly Mock<ILeaseRepository> _leases = new(MockBehavior.Strict);
    private readonly Mock<ICurrentUserContext> _currentUser = new(MockBehavior.Strict);
    private readonly Mock<ILandlordDashboardCache> _cache = new(MockBehavior.Strict);
    private readonly Mock<IEventPublisher> _events = new();

    private const string PlainToken = "valid-token-1234567890ABCDE";
    private const string TenantEmail = "tenant@example.com";
    private static readonly string TokenHashHex = InviteTokenHasher.Hash(PlainToken);

    private ClaimInviteHandler BuildSut() =>
        new(
            new ClaimInviteValidator(),
            _invites.Object,
            _leases.Object,
            _currentUser.Object,
            _cache.Object,
            _events.Object);

    private static User SeedTenant(string email = TenantEmail) => new()
    {
        Id = Guid.NewGuid(),
        KeycloakSubId = "kc-returning-tenant",
        Email = email,
        FirstName = "Ada",
        LastName = "Lovelace",
        AccountStatus = TenantAccountStatus.Active,
    };

    private static Invite SeedInvite(
        InviteStatus status = InviteStatus.Pending,
        DateTime? expiresAt = null,
        string email = TenantEmail,
        Guid? landlordId = null) => new()
        {
            Id = Guid.NewGuid(),
            LandlordId = landlordId ?? Guid.NewGuid(),
            PropertyId = Guid.NewGuid(),
            Property = new Property
            {
                Id = Guid.NewGuid(),
                LandlordId = landlordId ?? Guid.NewGuid(),
                Name = "Sunset Apt",
                Address = "1 Sunset Blvd",
            },
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
    public async Task Happy_path_creates_lease_marks_accepted_and_invalidates_cache()
    {
        var tenant = SeedTenant();
        var invite = SeedInvite();

        _currentUser.Setup(c => c.GetOrSyncUserAsync(It.IsAny<CancellationToken>()))
                    .ReturnsAsync(tenant);
        _invites.Setup(i => i.GetByTokenHashAsync(TokenHashHex, It.IsAny<CancellationToken>()))
                .ReturnsAsync(invite);

        _leases.Setup(l => l.HasActiveLeaseForPropertyAsync(invite.PropertyId, It.IsAny<CancellationToken>()))
               .ReturnsAsync(false);
        Lease? addedLease = null;
        _leases.Setup(l => l.AddAsync(It.IsAny<Lease>(), It.IsAny<CancellationToken>()))
               .Callback<Lease, CancellationToken>((l, _) => addedLease = l)
               .Returns(Task.CompletedTask);
        _invites.Setup(i => i.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
        _cache.Setup(c => c.InvalidateAsync(invite.LandlordId, It.IsAny<CancellationToken>()))
              .Returns(Task.CompletedTask);

        var result = await BuildSut().Handle(new ClaimInviteCommand(PlainToken), CancellationToken.None);

        Assert.Equal(invite.Id, result.InviteId);
        Assert.NotEqual(Guid.Empty, result.LeaseId);

        Assert.NotNull(addedLease);
        Assert.Equal(invite.LandlordId, addedLease!.LandlordId);
        Assert.Equal(invite.PropertyId, addedLease.PropertyId);
        Assert.Equal(tenant.Id, addedLease.TenantId);
        Assert.Equal(LeaseStatus.Active, addedLease.Status);
        Assert.Equal(invite.ProposedMonthlyRent, addedLease.MonthlyRent);
        Assert.Equal(invite.Currency, addedLease.Currency);

        Assert.Equal(InviteStatus.Accepted, invite.Status);
        Assert.NotNull(invite.AcceptedAt);

        _cache.Verify(c => c.InvalidateAsync(invite.LandlordId, It.IsAny<CancellationToken>()), Times.Once);

        // InviteAccepted event published after commit, carrying the returning tenant.
        _events.Verify(e => e.PublishAsync(
            It.Is<InviteAcceptedEvent>(ev =>
                ev.InviteId == invite.Id &&
                ev.LandlordId == invite.LandlordId &&
                ev.PropertyName == invite.Property!.Name &&
                ev.TenantId == tenant.Id),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Matches_email_case_insensitively()
    {
        var tenant = SeedTenant(email: "Tenant@Example.com");
        var invite = SeedInvite(email: "tenant@example.com");

        _currentUser.Setup(c => c.GetOrSyncUserAsync(It.IsAny<CancellationToken>()))
                    .ReturnsAsync(tenant);
        _invites.Setup(i => i.GetByTokenHashAsync(TokenHashHex, It.IsAny<CancellationToken>()))
                .ReturnsAsync(invite);
        _leases.Setup(l => l.HasActiveLeaseForPropertyAsync(invite.PropertyId, It.IsAny<CancellationToken>()))
               .ReturnsAsync(false);
        _leases.Setup(l => l.AddAsync(It.IsAny<Lease>(), It.IsAny<CancellationToken>()))
               .Returns(Task.CompletedTask);
        _invites.Setup(i => i.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);
        _cache.Setup(c => c.InvalidateAsync(invite.LandlordId, It.IsAny<CancellationToken>()))
              .Returns(Task.CompletedTask);

        var result = await BuildSut().Handle(new ClaimInviteCommand(PlainToken), CancellationToken.None);

        Assert.Equal(InviteStatus.Accepted, invite.Status);
        Assert.NotEqual(Guid.Empty, result.LeaseId);
    }

    [Fact]
    public async Task Throws_Conflict_when_property_already_has_active_lease()
    {
        var tenant = SeedTenant();
        var invite = SeedInvite();

        _currentUser.Setup(c => c.GetOrSyncUserAsync(It.IsAny<CancellationToken>()))
                    .ReturnsAsync(tenant);
        _invites.Setup(i => i.GetByTokenHashAsync(TokenHashHex, It.IsAny<CancellationToken>()))
                .ReturnsAsync(invite);
        _leases.Setup(l => l.HasActiveLeaseForPropertyAsync(invite.PropertyId, It.IsAny<CancellationToken>()))
               .ReturnsAsync(true);

        var ex = await Assert.ThrowsAsync<ConflictException>(
            () => BuildSut().Handle(new ClaimInviteCommand(PlainToken), CancellationToken.None));
        Assert.Contains("active lease", ex.Message, StringComparison.OrdinalIgnoreCase);

        Assert.NotEqual(InviteStatus.Accepted, invite.Status);
        _leases.Verify(l => l.AddAsync(It.IsAny<Lease>(), It.IsAny<CancellationToken>()), Times.Never);
        _events.Verify(e => e.PublishAsync(It.IsAny<InviteAcceptedEvent>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Throws_Forbidden_when_email_does_not_match()
    {
        var tenant = SeedTenant(email: "someone-else@example.com");
        var invite = SeedInvite(email: "intended@example.com");

        _currentUser.Setup(c => c.GetOrSyncUserAsync(It.IsAny<CancellationToken>()))
                    .ReturnsAsync(tenant);
        _invites.Setup(i => i.GetByTokenHashAsync(TokenHashHex, It.IsAny<CancellationToken>()))
                .ReturnsAsync(invite);

        await Assert.ThrowsAsync<ForbiddenException>(
            () => BuildSut().Handle(new ClaimInviteCommand(PlainToken), CancellationToken.None));

        _leases.VerifyNoOtherCalls();
        _cache.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Throws_NotFound_when_invite_does_not_exist()
    {
        _currentUser.Setup(c => c.GetOrSyncUserAsync(It.IsAny<CancellationToken>()))
                    .ReturnsAsync(SeedTenant());
        _invites.Setup(i => i.GetByTokenHashAsync(TokenHashHex, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Invite?)null);

        await Assert.ThrowsAsync<NotFoundException>(
            () => BuildSut().Handle(new ClaimInviteCommand(PlainToken), CancellationToken.None));

        _leases.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(InviteStatus.Accepted)]
    [InlineData(InviteStatus.Rejected)]
    [InlineData(InviteStatus.Expired)]
    public async Task Throws_NotFound_for_non_pending_invite(InviteStatus status)
    {
        var invite = SeedInvite(status: status);
        _currentUser.Setup(c => c.GetOrSyncUserAsync(It.IsAny<CancellationToken>()))
                    .ReturnsAsync(SeedTenant());
        _invites.Setup(i => i.GetByTokenHashAsync(TokenHashHex, It.IsAny<CancellationToken>()))
                .ReturnsAsync(invite);

        await Assert.ThrowsAsync<NotFoundException>(
            () => BuildSut().Handle(new ClaimInviteCommand(PlainToken), CancellationToken.None));

        _leases.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Throws_NotFound_for_expired_invite()
    {
        var invite = SeedInvite(expiresAt: DateTime.UtcNow.AddSeconds(-1));
        _currentUser.Setup(c => c.GetOrSyncUserAsync(It.IsAny<CancellationToken>()))
                    .ReturnsAsync(SeedTenant());
        _invites.Setup(i => i.GetByTokenHashAsync(TokenHashHex, It.IsAny<CancellationToken>()))
                .ReturnsAsync(invite);

        await Assert.ThrowsAsync<NotFoundException>(
            () => BuildSut().Handle(new ClaimInviteCommand(PlainToken), CancellationToken.None));

        _leases.VerifyNoOtherCalls();
    }
}
