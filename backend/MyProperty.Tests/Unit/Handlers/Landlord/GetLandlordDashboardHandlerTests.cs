using Moq;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Landlord.Queries.GetLandlordDashboard;

namespace MyProperty.Tests.Unit.Handlers.Landlord;

public sealed class GetLandlordDashboardHandlerTests
{
    private readonly Mock<ILandlordDashboardCache> _cache = new(MockBehavior.Strict);
    private readonly Mock<ILandlordDashboardRepository> _repo = new(MockBehavior.Strict);

    private GetLandlordDashboardHandler BuildSut() =>
        new(new GetLandlordDashboardValidator(), _cache.Object, _repo.Object);

    [Fact]
    public async Task Cache_hit_returns_cached_value_and_skips_repository()
    {
        var landlordId = Guid.NewGuid();
        var cached = new LandlordDashboardDto(
            TotalProperties: 3,
            ActiveLeases: 2,
            ActiveTenants: 2,
            PendingPayments: 1,
            OverduePayments: 0,
            GeneratedAt: DateTime.UtcNow);

        _cache.Setup(c => c.GetAsync(landlordId, It.IsAny<CancellationToken>()))
              .ReturnsAsync(cached);

        var sut = BuildSut();
        var result = await sut.Handle(new GetLandlordDashboardQuery(landlordId), CancellationToken.None);

        Assert.Same(cached, result);
        _repo.VerifyNoOtherCalls();
        _cache.Verify(c => c.SetAsync(It.IsAny<Guid>(), It.IsAny<LandlordDashboardDto>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Cache_miss_queries_repository_and_populates_cache()
    {
        var landlordId = Guid.NewGuid();
        var fresh = new LandlordDashboardDto(5, 3, 3, 2, 1, DateTime.UtcNow);

        _cache.Setup(c => c.GetAsync(landlordId, It.IsAny<CancellationToken>()))
              .ReturnsAsync((LandlordDashboardDto?)null);
        _repo.Setup(r => r.GetForLandlordAsync(landlordId, It.IsAny<CancellationToken>()))
             .ReturnsAsync(fresh);
        _cache.Setup(c => c.SetAsync(landlordId, fresh, It.IsAny<CancellationToken>()))
              .Returns(Task.CompletedTask);

        var sut = BuildSut();
        var result = await sut.Handle(new GetLandlordDashboardQuery(landlordId), CancellationToken.None);

        Assert.Same(fresh, result);
        _repo.Verify(r => r.GetForLandlordAsync(landlordId, It.IsAny<CancellationToken>()), Times.Once);
        _cache.Verify(c => c.SetAsync(landlordId, fresh, It.IsAny<CancellationToken>()), Times.Once);
    }
}
