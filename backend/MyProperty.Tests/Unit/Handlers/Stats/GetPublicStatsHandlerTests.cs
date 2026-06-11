using Moq;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Stats.Queries.GetPublicStats;

namespace MyProperty.Tests.Unit.Handlers.Stats;

public sealed class GetPublicStatsHandlerTests
{
    private readonly Mock<IPublicStatsRepository> _repo = new(MockBehavior.Strict);

    // The query is parameterless, so the validator always passes — instantiate
    // it directly (validators are pure and cheap; no point mocking them).
    private GetPublicStatsHandler BuildSut() =>
        new(new GetPublicStatsValidator(), _repo.Object);

    [Fact]
    public async Task Handle_returns_repository_result()
    {
        var dto = new PublicStatsDto(RentCollected: 1234m, Currency: "EUR", PropertiesManaged: 7, LandlordsOnboarded: 3);
        _repo.Setup(r => r.GetAsync(It.IsAny<CancellationToken>()))
             .ReturnsAsync(dto);

        var sut = BuildSut();
        var result = await sut.Handle(new GetPublicStatsQuery(), CancellationToken.None);

        Assert.Same(dto, result);
        _repo.Verify(r => r.GetAsync(It.IsAny<CancellationToken>()), Times.Once);
        _repo.VerifyNoOtherCalls();
    }
}
