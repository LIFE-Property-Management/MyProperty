using Moq;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Invites.Commands.RejectInvite;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;
using MyProperty.Tests.Unit.Handlers.TestUtils;

namespace MyProperty.Tests.Unit.Handlers.Invites;

public sealed class RejectInviteHandlerTests
{
    private readonly Mock<IInviteRepository> _invites = new(MockBehavior.Strict);
    private readonly Mock<IEventPublisher>   _publisher = new();

    private const string PlainToken = "valid-token-1234567890ABCDE";
    private static readonly string TokenHashHex = TokenHasher.Hash(PlainToken);

    private RejectInviteHandler BuildSut() =>
        new(new RejectInviteValidator(), _invites.Object, _publisher.Object);

    private static Invite SeedInvite(
        InviteStatus status = InviteStatus.Pending,
        DateTime? expiresAt = null) => new()
    {
        Id = Guid.NewGuid(),
        LandlordId = Guid.NewGuid(),
        PropertyId = Guid.NewGuid(),
        Email = "tenant@example.com",
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
    public async Task Happy_path_marks_invite_rejected_and_saves()
    {
        var invite = SeedInvite();
        _invites.Setup(i => i.GetByTokenHashAsync(TokenHashHex, It.IsAny<CancellationToken>()))
                .ReturnsAsync(invite);
        _invites.Setup(i => i.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

        var sut = BuildSut();

        await sut.Handle(new RejectInviteCommand(PlainToken), CancellationToken.None);

        Assert.Equal(InviteStatus.Rejected, invite.Status);
        Assert.NotNull(invite.RejectedAt);
        _invites.Verify(i => i.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task NotFound_when_invite_missing()
    {
        _invites.Setup(i => i.GetByTokenHashAsync(TokenHashHex, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Invite?)null);

        var sut = BuildSut();

        await Assert.ThrowsAsync<NotFoundException>(
            () => sut.Handle(new RejectInviteCommand(PlainToken), CancellationToken.None));
    }

    [Theory]
    [InlineData(InviteStatus.Accepted)]
    [InlineData(InviteStatus.Rejected)]
    [InlineData(InviteStatus.Expired)]
    public async Task NotFound_for_non_pending(InviteStatus status)
    {
        var invite = SeedInvite(status: status);
        _invites.Setup(i => i.GetByTokenHashAsync(TokenHashHex, It.IsAny<CancellationToken>()))
                .ReturnsAsync(invite);

        var sut = BuildSut();

        await Assert.ThrowsAsync<NotFoundException>(
            () => sut.Handle(new RejectInviteCommand(PlainToken), CancellationToken.None));
    }

    [Fact]
    public async Task NotFound_for_expired()
    {
        var invite = SeedInvite(expiresAt: DateTime.UtcNow.AddSeconds(-1));
        _invites.Setup(i => i.GetByTokenHashAsync(TokenHashHex, It.IsAny<CancellationToken>()))
                .ReturnsAsync(invite);

        var sut = BuildSut();

        await Assert.ThrowsAsync<NotFoundException>(
            () => sut.Handle(new RejectInviteCommand(PlainToken), CancellationToken.None));
    }
}
