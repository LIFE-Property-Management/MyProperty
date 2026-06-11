using Moq;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Invites.Commands.RevokeInvite;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;

namespace MyProperty.Tests.Unit.Handlers.Invites;

public sealed class RevokeInviteHandlerTests
{
    private readonly Mock<IInviteRepository> _invites = new(MockBehavior.Strict);
    private readonly Mock<ICurrentUserContext> _currentUser = new();

    private static readonly Guid LandlordId = Guid.NewGuid();

    private RevokeInviteHandler BuildSut() =>
        new(new RevokeInviteValidator(), _invites.Object, _currentUser.Object);

    private void SetupLandlord(Guid? id = null) =>
        _currentUser.Setup(c => c.GetOrSyncUserAsync(It.IsAny<CancellationToken>()))
                    .ReturnsAsync(new User
                    {
                        Id = id ?? LandlordId,
                        KeycloakSubId = "kc-landlord",
                        Email = "landlord@example.com",
                        FirstName = "Land",
                        LastName = "Lord",
                    });

    private static Invite SeedInvite(
        InviteStatus status = InviteStatus.Pending, Guid? landlordId = null) => new()
        {
            Id = Guid.NewGuid(),
            LandlordId = landlordId ?? LandlordId,
            PropertyId = Guid.NewGuid(),
            Email = "tenant@example.com",
            FirstName = "Ada",
            LastName = "Lovelace",
            TokenHash = "hash",
            Status = status,
            ExpiresAt = DateTime.UtcNow.AddDays(5),
            ProposedStartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date),
            ProposedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
            ProposedMonthlyRent = 1000m,
            Currency = "EUR",
        };

    [Theory]
    [InlineData(InviteStatus.Pending)]
    [InlineData(InviteStatus.Expired)]
    public async Task Revokes_pending_or_expired_invite(InviteStatus status)
    {
        SetupLandlord();
        var invite = SeedInvite(status);
        _invites.Setup(i => i.GetByIdAsync(invite.Id, It.IsAny<CancellationToken>())).ReturnsAsync(invite);
        _invites.Setup(i => i.SaveChangesAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);

        await BuildSut().Handle(new RevokeInviteCommand(invite.Id), CancellationToken.None);

        Assert.Equal(InviteStatus.Revoked, invite.Status);
        _invites.Verify(i => i.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Throws_NotFound_when_invite_missing()
    {
        SetupLandlord();
        var id = Guid.NewGuid();
        _invites.Setup(i => i.GetByIdAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync((Invite?)null);

        await Assert.ThrowsAsync<NotFoundException>(
            () => BuildSut().Handle(new RevokeInviteCommand(id), CancellationToken.None));
    }

    [Fact]
    public async Task Throws_Forbidden_when_invite_belongs_to_another_landlord()
    {
        SetupLandlord();
        var invite = SeedInvite(landlordId: Guid.NewGuid());
        _invites.Setup(i => i.GetByIdAsync(invite.Id, It.IsAny<CancellationToken>())).ReturnsAsync(invite);

        await Assert.ThrowsAsync<ForbiddenException>(
            () => BuildSut().Handle(new RevokeInviteCommand(invite.Id), CancellationToken.None));

        Assert.Equal(InviteStatus.Pending, invite.Status);
    }

    [Theory]
    [InlineData(InviteStatus.Accepted)]
    [InlineData(InviteStatus.Rejected)]
    [InlineData(InviteStatus.Revoked)]
    public async Task Throws_Conflict_for_non_revocable_status(InviteStatus status)
    {
        SetupLandlord();
        var invite = SeedInvite(status);
        _invites.Setup(i => i.GetByIdAsync(invite.Id, It.IsAny<CancellationToken>())).ReturnsAsync(invite);

        await Assert.ThrowsAsync<ConflictException>(
            () => BuildSut().Handle(new RevokeInviteCommand(invite.Id), CancellationToken.None));

        Assert.Equal(status, invite.Status);
    }
}
