using Microsoft.Extensions.Logging;
using MyProperty.Application.Common.FeatureFlags;
using Unleash;

namespace MyProperty.Infrastructure.FeatureFlags;

/// <summary>
/// <see cref="IFeatureFlags"/> backed by the Unleash SDK. The injected
/// <see cref="IUnleash"/> reads an in-memory snapshot that a background poller
/// refreshes, so <c>IsEnabled</c> is a cheap local lookup (no per-call I/O).
/// Evaluation never throws — on any error we log and fall back to the caller's
/// default, mirroring the graceful degradation of <c>RedisLandlordDashboardCache</c>.
/// </summary>
internal sealed class UnleashFeatureFlags(
    IUnleash unleash,
    ILogger<UnleashFeatureFlags> logger) : IFeatureFlags
{
    public Task<bool> IsEnabledAsync(string flagName, bool defaultValue, CancellationToken ct = default)
    {
        try
        {
            return Task.FromResult(unleash.IsEnabled(flagName, defaultValue));
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "Feature-flag evaluation failed for {Flag}; falling back to default {Default}.",
                flagName, defaultValue);
            return Task.FromResult(defaultValue);
        }
    }
}
