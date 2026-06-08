using Microsoft.EntityFrameworkCore;
using MyProperty.Domain.Enums;
using MyProperty.Infrastructure.Persistence;
using Prometheus;

namespace MyProperty.Api.Metrics;

// TODO(NSM): No unit test was added for this worker — add coverage for the gauge update path.
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

                // NOTE: Relies on the global soft-delete query filter in AppDbContext to satisfy the
                // documented "DeletedAt IS NULL" part of the formula — the explicit filter here is only
                // Status == Active. Correct given the query filter; flagged so the dependency is intentional.
                var count = await db.Leases
                    .CountAsync(l => l.Status == LeaseStatus.Active, stoppingToken);

                ActiveLeasesGauge.Set(count);
                // TODO(NSM): Logs at Information level every 60s indefinitely. Consider LogDebug —
                // Program.cs deliberately suppresses /metrics request logging to avoid Loki spam, so a
                // per-minute info log is slightly at odds with that.
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
