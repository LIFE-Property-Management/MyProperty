using System.Collections.Concurrent;
using MyProperty.Application.Common.FeatureFlags;

namespace MyProperty.Tests.Integration.Fixtures;

/// <summary>
/// Test substitute for <see cref="IFeatureFlags"/>: returns a per-flag override
/// when a test has set one, otherwise the caller's default. Lets the integration
/// suite run without a live Unleash server (parallel to
/// <see cref="RecordingBackgroundJobQueue"/>).
/// </summary>
internal sealed class StubFeatureFlags : IFeatureFlags
{
    private readonly ConcurrentDictionary<string, bool> _overrides = new();

    /// <summary>Force a flag to a fixed value for subsequent evaluations.</summary>
    public void Set(string flagName, bool enabled) => _overrides[flagName] = enabled;

    public Task<bool> IsEnabledAsync(string flagName, bool defaultValue, CancellationToken ct = default)
        => Task.FromResult(_overrides.TryGetValue(flagName, out var value) ? value : defaultValue);
}
