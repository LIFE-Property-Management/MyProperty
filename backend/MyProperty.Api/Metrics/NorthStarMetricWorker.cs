using Microsoft.EntityFrameworkCore;
using MyProperty.Domain.Enums;
using MyProperty.Infrastructure.Persistence;
using Prometheus;

namespace MyProperty.Api.Metrics;

internal sealed class NorthStarMetricWorker(IServiceScopeFactory scopeFactory, ILogger<NorthStarMetricWorker> logger)
    : BackgroundService
{
    private static readonly Gauge ActiveLeasesGauge = Prometheus.Metrics.CreateGauge(
        "myproperty_active_leases_total",
        "Total active leases across the entire platform (North Star Metric).");

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var count = await db.Leases
                    .CountAsync(l => l.Status == LeaseStatus.Active, stoppingToken);

                ActiveLeasesGauge.Set(count);
                logger.LogInformation("NSM updated: myproperty_active_leases_total = {Count}", count);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(ex, "NSM gauge update failed — will retry in 60 s");
            }

            await Task.Delay(TimeSpan.FromSeconds(60), stoppingToken);
        }
    }
}
