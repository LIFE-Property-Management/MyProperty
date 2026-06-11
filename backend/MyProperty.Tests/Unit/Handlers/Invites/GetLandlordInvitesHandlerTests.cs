using Moq;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Invites.Queries.GetLandlordInvites;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;

namespace MyProperty.Tests.Unit.Handlers.Invites;

public sealed class GetLandlordInvitesHandlerTests
{
    private readonly Mock<IInviteRepository> _invites = new(MockBehavior.Strict);
    private readonly Mock<ICurrentUserContext> _currentUser = new();

    private static readonly Guid LandlordId = Guid.NewGuid();

    private GetLandlordInvitesHandler BuildSut() =>
        new(new GetLandlordInvitesValidator(), _invites.Object, _currentUser.Object);

    private void SetupLandlord() =>
        _currentUser.Setup(c => c.GetOrSyncUserAsync(It.IsAny<CancellationToken>()))
                    .ReturnsAsync(new User
                    {
                        Id = LandlordId,
                        KeycloakSubId = "kc-landlord",
                        Email = "landlord@example.com",
                        FirstName = "Land",
                        LastName = "Lord",
                    });

    private static Invite SeedInvite(InviteStatus status = InviteStatus.Pending) => new()
    {
        Id = Guid.NewGuid(),
        LandlordId = LandlordId,
        PropertyId = Guid.NewGuid(),
        Property = new Property
        {
            Id = Guid.NewGuid(),
            LandlordId = LandlordId,
            Name = "Sunset Apt",
            Address = "1 Sunset Blvd",
        },
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

    [Fact]
    public async Task Maps_repo_rows_to_dtos_and_scopes_to_current_landlord()
    {
        SetupLandlord();
        var invite = SeedInvite();
        _invites.Setup(i => i.ListByLandlordAsync(
                    LandlordId, 1, 20, null, It.IsAny<CancellationToken>()))
                .ReturnsAsync(([invite], 1));

        var result = await BuildSut().Handle(new GetLandlordInvitesQuery(1, 20, null), CancellationToken.None);

        Assert.Equal(1, result.TotalCount);
        var item = Assert.Single(result.Items);
        Assert.Equal(invite.Id, item.Id);
        Assert.Equal(invite.PropertyId, item.PropertyId);
        Assert.Equal("Sunset Apt", item.PropertyName);
        Assert.Equal(invite.Email, item.Email);
        Assert.Equal(InviteStatus.Pending, item.Status);
        Assert.Equal(invite.ExpiresAt, item.ExpiresAt);
    }

    [Fact]
    public async Task Passes_status_filter_through_to_repository()
    {
        SetupLandlord();
        _invites.Setup(i => i.ListByLandlordAsync(
                    LandlordId, 2, 10, InviteStatus.Revoked, It.IsAny<CancellationToken>()))
                .ReturnsAsync((Array.Empty<Invite>(), 0));

        var result = await BuildSut().Handle(
            new GetLandlordInvitesQuery(2, 10, InviteStatus.Revoked), CancellationToken.None);

        Assert.Empty(result.Items);
        Assert.Equal(0, result.TotalCount);
        _invites.Verify(i => i.ListByLandlordAsync(
            LandlordId, 2, 10, InviteStatus.Revoked, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData(0, 20)]
    [InlineData(1, 0)]
    [InlineData(1, 101)]
    public async Task Rejects_invalid_paging(int page, int pageSize)
    {
        await Assert.ThrowsAsync<ValidationException>(
            () => BuildSut().Handle(new GetLandlordInvitesQuery(page, pageSize, null), CancellationToken.None));

        _invites.VerifyNoOtherCalls();
    }
}
