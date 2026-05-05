// M3.5 — Redis cache-aside benchmark for the landlord-dashboard handler.
//
// Boots only the DI services the handler needs (DbContext, IDistributedCache,
// the dashboard repository + cache). Skips the API HTTP layer entirely so
// JWT/Keycloak isn't involved — the bench measures handler latency, which is
// what the cache-aside pattern actually changes.
//
// Reads connection strings from env vars with sensible localhost defaults:
//   POSTGRES_CONN  default: "Host=localhost;Port=5432;Database=myproperty_bench;Username=postgres;Password=postgres"
//   REDIS_CONN     default: "localhost:6379"
//
// Usage:
//   dotnet run -- <landlord-keycloak-sub-id>   # e.g. kc-landlord-1 from the M3.4 seed
//
// Output: a markdown-friendly results table on stdout.

using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Options;
using MyProperty.Application.Landlord.Queries.GetLandlordDashboard;
using MyProperty.Infrastructure.Caching;
using MyProperty.Infrastructure.Persistence;
using MyProperty.Infrastructure.Persistence.Repositories;

const int WarmupRuns      = 3;
const int Runs            = 20;

var landlordKey = args.Length > 0 ? args[0] : "kc-landlord-1";

var postgresConn = Environment.GetEnvironmentVariable("POSTGRES_CONN")
    ?? "Host=localhost;Port=5432;Database=myproperty_bench;Username=postgres;Password=postgres";
var redisConn = Environment.GetEnvironmentVariable("REDIS_CONN")
    ?? "localhost:6379";

var services = new ServiceCollection();
services.AddLogging(b => b.SetMinimumLevel(LogLevel.Warning).AddConsole());
services.AddDbContext<AppDbContext>(o => o.UseNpgsql(postgresConn));
services.AddStackExchangeRedisCache(o =>
{
    o.Configuration = redisConn;
    o.InstanceName  = "myproperty:bench:";
});
services.Configure<CacheOptions>(o =>
{
    o.RedisConnection             = redisConn;
    o.InstancePrefix              = "myproperty:bench:";
    o.LandlordDashboardTtlSeconds = 60;
});
services.AddScoped<ILandlordDashboardRepository, LandlordDashboardRepository>();
services.AddScoped<ILandlordDashboardCache, RedisLandlordDashboardCache>();
services.AddScoped<GetLandlordDashboardHandler>();

await using var sp = services.BuildServiceProvider();

// Resolve a landlord Guid by KeycloakSubId so the bench works against the
// M3.4 seed dataset out of the box.
Guid landlordId;
await using (var scope = sp.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var landlord = await db.Users.AsNoTracking()
        .FirstOrDefaultAsync(u => u.KeycloakSubId == landlordKey)
        ?? throw new InvalidOperationException(
            $"No user with KeycloakSubId='{landlordKey}'. Did you seed the bench DB?");
    landlordId = landlord.Id;
}

Console.WriteLine($"Bench landlord: {landlordKey} → {landlordId}");
Console.WriteLine($"Postgres: {postgresConn}");
Console.WriteLine($"Redis:    {redisConn}");
Console.WriteLine($"Runs:     warmup={WarmupRuns}  measured={Runs}");
Console.WriteLine();

// Warm up the EF Core query plan cache + Postgres buffer cache + Redis
// connection pool so the measured runs reflect steady-state.
for (var i = 0; i < WarmupRuns; i++)
    await OneRun(invalidateFirst: true);
for (var i = 0; i < WarmupRuns; i++)
    await OneRun(invalidateFirst: false);

var miss = new double[Runs];
var hit  = new double[Runs];

for (var i = 0; i < Runs; i++)
    miss[i] = await OneRun(invalidateFirst: true);

for (var i = 0; i < Runs; i++)
    hit[i] = await OneRun(invalidateFirst: false);

PrintTable("MISS (cache invalidated before each call)", miss);
PrintTable("HIT  (cache populated; reads from Redis)", hit);

var pMiss = Median(miss);
var pHit  = Median(hit);
Console.WriteLine();
Console.WriteLine($"Median miss : {pMiss,7:F3} ms");
Console.WriteLine($"Median hit  : {pHit,7:F3} ms");
Console.WriteLine($"Speedup     : {(pMiss / Math.Max(pHit, 0.001)),6:F1}×");

return 0;

async Task<double> OneRun(bool invalidateFirst)
{
    await using var scope = sp.CreateAsyncScope();
    var cache   = scope.ServiceProvider.GetRequiredService<ILandlordDashboardCache>();
    var handler = scope.ServiceProvider.GetRequiredService<GetLandlordDashboardHandler>();

    if (invalidateFirst)
        await cache.InvalidateAsync(landlordId, CancellationToken.None);

    var sw = Stopwatch.StartNew();
    _ = await handler.Handle(new GetLandlordDashboardQuery(landlordId), CancellationToken.None);
    sw.Stop();
    return sw.Elapsed.TotalMilliseconds;
}

static double Median(double[] xs)
{
    var sorted = xs.OrderBy(x => x).ToArray();
    return sorted.Length % 2 == 1
        ? sorted[sorted.Length / 2]
        : (sorted[sorted.Length / 2 - 1] + sorted[sorted.Length / 2]) / 2.0;
}

static void PrintTable(string title, double[] xs)
{
    var sorted = xs.OrderBy(x => x).ToArray();
    Console.WriteLine();
    Console.WriteLine(title);
    Console.WriteLine($"  min    = {sorted[0],7:F3} ms");
    Console.WriteLine($"  median = {Median(xs),7:F3} ms");
    Console.WriteLine($"  p95    = {sorted[(int)(sorted.Length * 0.95)],7:F3} ms");
    Console.WriteLine($"  max    = {sorted[^1],7:F3} ms");
    Console.WriteLine($"  mean   = {xs.Average(),7:F3} ms");
}
