using Moq;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Domain.Entities;
using MyProperty.Infrastructure.Identity;

namespace MyProperty.Tests.Unit.Identity;

public sealed class CurrentUserContextTests
{
    private readonly Mock<ICurrentUser> _currentUser = new();
    private readonly Mock<IUserRepository> _users = new(MockBehavior.Strict);

    private const string Sub = "kc-sub-123";

    private CurrentUserContext BuildSut() => new(_currentUser.Object, _users.Object);

    private static User SeedUser() => new()
    {
        Id = Guid.NewGuid(),
        KeycloakSubId = Sub,
        Email = "user@example.com",
        FirstName = "User",
        LastName = "One",
    };

    [Fact]
    public async Task GetUserAsync_returns_user_resolved_by_sub()
    {
        var user = SeedUser();
        _currentUser.SetupGet(c => c.KeycloakSubId).Returns(Sub);
        _users.Setup(u => u.GetByKeycloakSubIdAsync(Sub, It.IsAny<CancellationToken>()))
              .ReturnsAsync(user);

        var result = await BuildSut().GetUserAsync(CancellationToken.None);

        Assert.Same(user, result);
    }

    [Fact]
    public async Task GetUserAsync_throws_Forbidden_when_unauthenticated()
    {
        _currentUser.SetupGet(c => c.KeycloakSubId).Returns((string?)null);

        await Assert.ThrowsAsync<ForbiddenException>(
            () => BuildSut().GetUserAsync(CancellationToken.None));

        _users.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task GetUserAsync_throws_Forbidden_when_user_not_in_table()
    {
        _currentUser.SetupGet(c => c.KeycloakSubId).Returns(Sub);
        _users.Setup(u => u.GetByKeycloakSubIdAsync(Sub, It.IsAny<CancellationToken>()))
              .ReturnsAsync((User?)null);

        await Assert.ThrowsAsync<ForbiddenException>(
            () => BuildSut().GetUserAsync(CancellationToken.None));
    }

    [Fact]
    public async Task GetOrSyncUserAsync_returns_synced_user_from_claims()
    {
        var user = SeedUser();
        _currentUser.SetupGet(c => c.KeycloakSubId).Returns(Sub);
        _currentUser.SetupGet(c => c.Email).Returns("user@example.com");
        _currentUser.SetupGet(c => c.FirstName).Returns("User");
        _currentUser.SetupGet(c => c.LastName).Returns("One");
        _currentUser.SetupGet(c => c.Phone).Returns((string?)null);
        _users.Setup(u => u.GetOrSyncAsync(Sub, "user@example.com", "User", "One", null, It.IsAny<CancellationToken>()))
              .ReturnsAsync(user);

        var result = await BuildSut().GetOrSyncUserAsync(CancellationToken.None);

        Assert.Same(user, result);
    }

    [Fact]
    public async Task GetOrSyncUserAsync_throws_Forbidden_when_unauthenticated()
    {
        _currentUser.SetupGet(c => c.KeycloakSubId).Returns((string?)null);

        await Assert.ThrowsAsync<ForbiddenException>(
            () => BuildSut().GetOrSyncUserAsync(CancellationToken.None));

        _users.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task GetUserAsync_threads_cancellation_token_to_repository()
    {
        using var cts = new CancellationTokenSource();
        var user = SeedUser();
        _currentUser.SetupGet(c => c.KeycloakSubId).Returns(Sub);
        _users.Setup(u => u.GetByKeycloakSubIdAsync(Sub, cts.Token)).ReturnsAsync(user);

        await BuildSut().GetUserAsync(cts.Token);

        _users.Verify(u => u.GetByKeycloakSubIdAsync(Sub, cts.Token), Times.Once);
    }

    [Fact]
    public async Task GetOrSyncUserAsync_threads_cancellation_token_to_repository()
    {
        using var cts = new CancellationTokenSource();
        var user = SeedUser();
        _currentUser.SetupGet(c => c.KeycloakSubId).Returns(Sub);
        _currentUser.SetupGet(c => c.Email).Returns("user@example.com");
        _currentUser.SetupGet(c => c.FirstName).Returns("User");
        _currentUser.SetupGet(c => c.LastName).Returns("One");
        _currentUser.SetupGet(c => c.Phone).Returns((string?)null);
        _users.Setup(u => u.GetOrSyncAsync(Sub, "user@example.com", "User", "One", null, cts.Token)).ReturnsAsync(user);

        await BuildSut().GetOrSyncUserAsync(cts.Token);

        _users.Verify(u => u.GetOrSyncAsync(Sub, "user@example.com", "User", "One", null, cts.Token), Times.Once);
    }
}
