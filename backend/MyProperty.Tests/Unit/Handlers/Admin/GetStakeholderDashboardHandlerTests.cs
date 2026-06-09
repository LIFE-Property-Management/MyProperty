using Moq;
using MyProperty.Application.Admin.Queries.GetStakeholderDashboard;
using MyProperty.Application.Common.Interfaces;

namespace MyProperty.Tests.Unit.Handlers.Admin;

public sealed class GetStakeholderDashboardHandlerTests
{
    private readonly Mock<IStakeholderDashboardCache> _cache = new(MockBehavior.Strict);
    private readonly Mock<IStakeholderDashboardRepository> _repo = new(MockBehavior.Strict);

    private GetStakeholderDashboardHandler BuildSut() =>
        new(new GetStakeholderDashboardValidator(), _cache.Object, _repo.Object);

    private static StakeholderDashboardDto SampleDto() => new(
        Growth: new GrowthSection(0, 0, 0, 0, []),
        Adoption: new AdoptionSection(0, 0, 0m, 0, 0, []),
        InviteFunnel: new InviteFunnelSection(0, 0, 0, 0, 0, 0m, []),
        Financial: new FinancialSection([], 0m, 0m, []),
        SystemHealth: new SystemHealthSection(0, 0),
        GeneratedAt: DateTime.UtcNow);

    [Fact]
    public async Task Cache_hit_returns_cached_value_and_skips_repository()
    {
        var cached = SampleDto();
        _cache.Setup(c => c.GetAsync(It.IsAny<CancellationToken>()))
              .ReturnsAsync(cached);

        var sut = BuildSut();
        var result = await sut.Handle(new GetStakeholderDashboardQuery(), CancellationToken.None);

        Assert.Same(cached, result);
        _repo.VerifyNoOtherCalls();
        _cache.Verify(c => c.SetAsync(It.IsAny<StakeholderDashboardDto>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Cache_miss_queries_repository_and_populates_cache()
    {
        var fresh = SampleDto();
        _cache.Setup(c => c.GetAsync(It.IsAny<CancellationToken>()))
              .ReturnsAsync((StakeholderDashboardDto?)null);
        _repo.Setup(r => r.GetAsync(It.IsAny<CancellationToken>()))
             .ReturnsAsync(fresh);
        _cache.Setup(c => c.SetAsync(fresh, It.IsAny<CancellationToken>()))
              .Returns(Task.CompletedTask);

        var sut = BuildSut();
        var result = await sut.Handle(new GetStakeholderDashboardQuery(), CancellationToken.None);

        Assert.Same(fresh, result);
        _repo.Verify(r => r.GetAsync(It.IsAny<CancellationToken>()), Times.Once);
        _cache.Verify(c => c.SetAsync(fresh, It.IsAny<CancellationToken>()), Times.Once);
    }
}
