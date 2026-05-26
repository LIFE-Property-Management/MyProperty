using Moq;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Invites.Queries.GetInviteByToken;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;
using MyProperty.Tests.Unit.Handlers.TestUtils;

namespace MyProperty.Tests.Unit.Handlers.Invites;

public sealed class GetInviteByTokenHandlerTests
{
    private readonly Mock<IInviteRepository> _invites = new(MockBehavior.Strict);

    private const string PlainToken = "valid-token-1234567890ABCDE";
    private static readonly string TokenHashHex = TokenHasher.Hash(PlainToken);

    private GetInviteByTokenHandler BuildSut() =>
        new(new GetInviteByTokenValidator(), _invites.Object);

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
            ProposedMonthlyRent = 1234m,
            Currency = "USD",
            Property = new Property
            {
                Id = Guid.NewGuid(),
                LandlordId = Guid.NewGuid(),
                Name = "Sunset Apt",
                Address = "1 Sunset Blvd",
            },
            Landlord = new User
            {
                Id = Guid.NewGuid(),
                KeycloakSubId = "kc-landlord",
                Email = "landlord@example.com",
                FirstName = "Lila",
                LastName = "Landlord",
            },
        };

    [Fact]
    public async Task Happy_path_returns_full_preview()
    {
        var invite = SeedInvite();
        _invites.Setup(i => i.GetByTokenHashAsync(TokenHashHex, It.IsAny<CancellationToken>()))
                .ReturnsAsync(invite);

        var sut = BuildSut();
        var dto = await sut.Handle(new GetInviteByTokenQuery(PlainToken), CancellationToken.None);

        Assert.Equal(invite.Property!.Name, dto.PropertyName);
        Assert.Equal(invite.Property.Address, dto.PropertyAddress);
        Assert.Equal("Lila Landlord", dto.LandlordFullName);
        Assert.Equal("Ada", dto.TenantFirstName);
        Assert.Equal("Lovelace", dto.TenantLastName);
        Assert.Equal("tenant@example.com", dto.TenantEmail);
        Assert.Equal(invite.ProposedMonthlyRent, dto.ProposedMonthlyRent);
        Assert.Equal("USD", dto.Currency);
        Assert.Equal(invite.ExpiresAt, dto.ExpiresAt);
    }

    [Fact]
    public async Task NotFound_when_missing()
    {
        _invites.Setup(i => i.GetByTokenHashAsync(TokenHashHex, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Invite?)null);

        var sut = BuildSut();

        await Assert.ThrowsAsync<NotFoundException>(
            () => sut.Handle(new GetInviteByTokenQuery(PlainToken), CancellationToken.None));
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
            () => sut.Handle(new GetInviteByTokenQuery(PlainToken), CancellationToken.None));
    }

    [Fact]
    public async Task NotFound_for_expired()
    {
        var invite = SeedInvite(expiresAt: DateTime.UtcNow.AddSeconds(-1));
        _invites.Setup(i => i.GetByTokenHashAsync(TokenHashHex, It.IsAny<CancellationToken>()))
                .ReturnsAsync(invite);

        var sut = BuildSut();

        await Assert.ThrowsAsync<NotFoundException>(
            () => sut.Handle(new GetInviteByTokenQuery(PlainToken), CancellationToken.None));
    }
}
