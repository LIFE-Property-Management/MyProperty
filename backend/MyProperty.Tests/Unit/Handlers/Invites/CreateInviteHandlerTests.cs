using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using MyProperty.Application.Common.Email;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Options;
using MyProperty.Application.Invites.Commands.CreateInvite;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;
using MyProperty.Tests.Unit.Handlers.TestUtils;

namespace MyProperty.Tests.Unit.Handlers.Invites;

public sealed class CreateInviteHandlerTests
{
    private readonly Mock<IUserRepository> _users = new(MockBehavior.Strict);
    private readonly Mock<IPropertyRepository> _properties = new(MockBehavior.Strict);
    private readonly Mock<IInviteRepository> _invites = new(MockBehavior.Strict);
    private readonly Mock<IBackgroundJobQueue> _jobs = new(MockBehavior.Strict);
    private readonly Mock<ICurrentUser> _currentUser = new();

    private readonly InviteOptions _options = new() { PortalBaseUrl = "https://portal.test", ExpiryDays = 7 };

    private CreateInviteHandler BuildSut() =>
        new(
            new CreateInviteValidator(),
            _users.Object,
            _properties.Object,
            _invites.Object,
            _jobs.Object,
            _currentUser.Object,
            Options.Create(_options),
            NullLogger<CreateInviteHandler>.Instance);

    private static User SeedLandlord(Guid id) => new()
    {
        Id = id,
        KeycloakSubId = "kc-landlord",
        Email = "landlord@example.com",
        FirstName = "Landlord",
        LastName = "One",
    };

    private static Property SeedProperty(Guid landlordId) => new()
    {
        Id = Guid.NewGuid(),
        LandlordId = landlordId,
        Name = "Sunset Apt",
        Address = "1 Sunset Blvd",
    };

    private static CreateInviteCommand ValidCommand(Guid propertyId) => new(
        PropertyId:          propertyId,
        Email:               "tenant@example.com",
        FirstName:           "Ada",
        LastName:            "Lovelace",
        ProposedStartDate:   DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(1),
        ProposedEndDate:     DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
        ProposedMonthlyRent: 850m,
        Currency:            "EUR");

    [Fact]
    public async Task Happy_path_persists_invite_and_enqueues_email()
    {
        var landlord = SeedLandlord(Guid.NewGuid());
        var property = SeedProperty(landlord.Id);

        _currentUser.SetupGet(c => c.Principal).Returns(TestPrincipal.Authenticated(landlord.KeycloakSubId));
        _users.Setup(u => u.GetOrSyncFromClaimsAsync(It.IsAny<System.Security.Claims.ClaimsPrincipal>(), It.IsAny<CancellationToken>()))
              .ReturnsAsync(landlord);
        _properties.Setup(p => p.GetByIdAsync(property.Id, It.IsAny<CancellationToken>()))
                   .ReturnsAsync(property);

        Invite? added = null;
        _invites.Setup(i => i.AddAsync(It.IsAny<Invite>(), It.IsAny<CancellationToken>()))
                .Callback<Invite, CancellationToken>((inv, _) => added = inv)
                .Returns(Task.CompletedTask);
        _invites.Setup(i => i.SaveChangesAsync(It.IsAny<CancellationToken>()))
                .Returns(Task.CompletedTask);

        EmailMessage? enqueued = null;
        _jobs.Setup(j => j.EnqueueEmail(It.IsAny<EmailMessage>()))
             .Callback<EmailMessage>(m => enqueued = m)
             .Returns("job-id");

        var sut = BuildSut();

        var result = await sut.Handle(ValidCommand(property.Id), CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.InviteId);
        Assert.True(result.ExpiresAt > DateTime.UtcNow.AddDays(6));
        Assert.True(result.ExpiresAt <= DateTime.UtcNow.AddDays(7).AddMinutes(1));

        Assert.NotNull(added);
        Assert.Equal(InviteStatus.Pending, added!.Status);
        Assert.Equal(landlord.Id, added.LandlordId);
        Assert.Equal(property.Id, added.PropertyId);
        Assert.Equal("tenant@example.com", added.Email);
        Assert.Equal(64, added.TokenHash.Length); // SHA256 hex
        Assert.Matches("^[a-f0-9]{64}$", added.TokenHash);

        Assert.NotNull(enqueued);
        Assert.Equal("tenant@example.com", enqueued!.To);
        Assert.Contains("Sunset Apt", enqueued.Subject);
        Assert.Contains("https://portal.test/invites/", enqueued.Body);
        Assert.True(enqueued.IsHtml);

        // Sanity: the URL contains the *plain* token, not the hash.
        Assert.DoesNotContain(added.TokenHash, enqueued.Body);
    }

    [Fact]
    public async Task Throws_NotFound_when_property_does_not_exist()
    {
        var landlord = SeedLandlord(Guid.NewGuid());
        var missingPropertyId = Guid.NewGuid();

        _currentUser.SetupGet(c => c.Principal).Returns(TestPrincipal.Authenticated(landlord.KeycloakSubId));
        _users.Setup(u => u.GetOrSyncFromClaimsAsync(It.IsAny<System.Security.Claims.ClaimsPrincipal>(), It.IsAny<CancellationToken>()))
              .ReturnsAsync(landlord);
        _properties.Setup(p => p.GetByIdAsync(missingPropertyId, It.IsAny<CancellationToken>()))
                   .ReturnsAsync((Property?)null);

        var sut = BuildSut();

        var ex = await Assert.ThrowsAsync<NotFoundException>(
            () => sut.Handle(ValidCommand(missingPropertyId), CancellationToken.None));
        Assert.Equal("Property", ex.Resource);

        _invites.Verify(i => i.AddAsync(It.IsAny<Invite>(), It.IsAny<CancellationToken>()), Times.Never);
        _jobs.Verify(j => j.EnqueueEmail(It.IsAny<EmailMessage>()), Times.Never);
    }

    [Fact]
    public async Task Throws_Forbidden_when_property_belongs_to_other_landlord()
    {
        var landlord = SeedLandlord(Guid.NewGuid());
        var otherLandlordId = Guid.NewGuid();
        var property = SeedProperty(otherLandlordId);

        _currentUser.SetupGet(c => c.Principal).Returns(TestPrincipal.Authenticated(landlord.KeycloakSubId));
        _users.Setup(u => u.GetOrSyncFromClaimsAsync(It.IsAny<System.Security.Claims.ClaimsPrincipal>(), It.IsAny<CancellationToken>()))
              .ReturnsAsync(landlord);
        _properties.Setup(p => p.GetByIdAsync(property.Id, It.IsAny<CancellationToken>()))
                   .ReturnsAsync(property);

        var sut = BuildSut();

        await Assert.ThrowsAsync<ForbiddenException>(
            () => sut.Handle(ValidCommand(property.Id), CancellationToken.None));

        _invites.Verify(i => i.AddAsync(It.IsAny<Invite>(), It.IsAny<CancellationToken>()), Times.Never);
        _jobs.Verify(j => j.EnqueueEmail(It.IsAny<EmailMessage>()), Times.Never);
    }

    [Fact]
    public async Task Validation_failure_short_circuits_before_repos_are_touched()
    {
        var sut = BuildSut();

        await Assert.ThrowsAsync<ValidationException>(
            () => sut.Handle(ValidCommand(Guid.Empty), CancellationToken.None));

        _users.VerifyNoOtherCalls();
        _properties.VerifyNoOtherCalls();
        _invites.VerifyNoOtherCalls();
        _jobs.VerifyNoOtherCalls();
    }
}
