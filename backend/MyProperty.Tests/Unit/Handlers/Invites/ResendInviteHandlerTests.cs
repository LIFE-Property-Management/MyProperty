using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using MyProperty.Application.Common.Email;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Options;
using MyProperty.Application.Invites;
using MyProperty.Application.Invites.Commands.ResendInvite;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;

namespace MyProperty.Tests.Unit.Handlers.Invites;

public sealed class ResendInviteHandlerTests
{
    private readonly Mock<IInviteRepository> _invites = new(MockBehavior.Strict);
    private readonly Mock<IBackgroundJobQueue> _jobs = new(MockBehavior.Strict);
    private readonly Mock<ICurrentUserContext> _currentUser = new();

    private readonly InviteOptions _options = new() { PortalBaseUrl = "https://portal.test", ExpiryDays = 7 };

    private static readonly Guid LandlordId = Guid.NewGuid();

    private ResendInviteHandler BuildSut() =>
        new(
            new ResendInviteValidator(),
            _invites.Object,
            _jobs.Object,
            _currentUser.Object,
            Options.Create(_options),
            NullLogger<ResendInviteHandler>.Instance);

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

    private static Invite SeedInvite(
        InviteStatus status = InviteStatus.Pending,
        Guid? landlordId = null,
        DateTime? expiresAt = null) => new()
        {
            Id = Guid.NewGuid(),
            LandlordId = landlordId ?? LandlordId,
            PropertyId = Guid.NewGuid(),
            Property = new Property
            {
                Id = Guid.NewGuid(),
                LandlordId = landlordId ?? LandlordId,
                Name = "Sunset Apt",
                Address = "1 Sunset Blvd",
            },
            Landlord = new User
            {
                Id = landlordId ?? LandlordId,
                KeycloakSubId = "kc-landlord",
                Email = "landlord@example.com",
                FirstName = "Land",
                LastName = "Lord",
            },
            Email = "tenant@example.com",
            FirstName = "Ada",
            LastName = "Lovelace",
            TokenHash = "old-hash",
            Status = status,
            ExpiresAt = expiresAt ?? DateTime.UtcNow.AddDays(5),
            ProposedStartDate = DateOnly.FromDateTime(DateTime.UtcNow.Date),
            ProposedEndDate = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
            ProposedMonthlyRent = 1000m,
            Currency = "EUR",
        };

    [Fact]
    public async Task Reissues_token_resets_expiry_and_reenqueues_email()
    {
        SetupLandlord();
        // Expired invite: resend re-activates it to Pending.
        var invite = SeedInvite(InviteStatus.Expired, expiresAt: DateTime.UtcNow.AddDays(-1));
        var originalHash = invite.TokenHash;

        _invites.Setup(i => i.GetByIdAsync(invite.Id, It.IsAny<CancellationToken>())).ReturnsAsync(invite);
        _invites.Setup(i => i.SaveChangesAsync(It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        EmailMessage? enqueued = null;
        _jobs.Setup(j => j.EnqueueEmail(It.IsAny<EmailMessage>()))
             .Callback<EmailMessage>(m => enqueued = m)
             .Returns(Guid.NewGuid().ToString("N"));

        var before = DateTime.UtcNow;
        var result = await BuildSut().Handle(new ResendInviteCommand(invite.Id), CancellationToken.None);

        Assert.Equal(invite.Id, result.InviteId);
        Assert.Equal(InviteStatus.Pending, invite.Status);
        Assert.NotEqual(originalHash, invite.TokenHash);
        Assert.True(invite.ExpiresAt > before.AddDays(6));
        Assert.Equal(invite.ExpiresAt, result.ExpiresAt);

        Assert.NotNull(enqueued);
        Assert.Equal(invite.Email, enqueued!.To);
        // The fresh plain token (not the stored hash) is what lands in the email link.
        Assert.DoesNotContain(invite.TokenHash, enqueued.Body);
        _invites.Verify(i => i.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _jobs.Verify(j => j.EnqueueEmail(It.IsAny<EmailMessage>()), Times.Once);
    }

    [Fact]
    public async Task Throws_NotFound_when_invite_missing()
    {
        SetupLandlord();
        var id = Guid.NewGuid();
        _invites.Setup(i => i.GetByIdAsync(id, It.IsAny<CancellationToken>())).ReturnsAsync((Invite?)null);

        await Assert.ThrowsAsync<NotFoundException>(
            () => BuildSut().Handle(new ResendInviteCommand(id), CancellationToken.None));

        _jobs.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Throws_Forbidden_when_invite_belongs_to_another_landlord()
    {
        SetupLandlord();
        var invite = SeedInvite(landlordId: Guid.NewGuid());
        _invites.Setup(i => i.GetByIdAsync(invite.Id, It.IsAny<CancellationToken>())).ReturnsAsync(invite);

        await Assert.ThrowsAsync<ForbiddenException>(
            () => BuildSut().Handle(new ResendInviteCommand(invite.Id), CancellationToken.None));

        _jobs.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(InviteStatus.Accepted)]
    [InlineData(InviteStatus.Rejected)]
    [InlineData(InviteStatus.Revoked)]
    public async Task Throws_Conflict_for_non_resendable_status(InviteStatus status)
    {
        SetupLandlord();
        var invite = SeedInvite(status);
        _invites.Setup(i => i.GetByIdAsync(invite.Id, It.IsAny<CancellationToken>())).ReturnsAsync(invite);

        await Assert.ThrowsAsync<ConflictException>(
            () => BuildSut().Handle(new ResendInviteCommand(invite.Id), CancellationToken.None));

        _jobs.VerifyNoOtherCalls();
    }
}
