using MyProperty.Application.Common.FeatureFlags;

namespace MyProperty.Infrastructure.FeatureFlags;

/// <summary>
/// No-op <see cref="IFeatureFlags"/> used when no Unleash API token is
/// configured. Every call returns the caller-supplied default, so the app
/// behaves exactly as if each flag were at its default. Directly parallel to
/// <c>NullEventPublisher</c> on the messaging side.
/// </summary>
internal sealed class NullFeatureFlags : IFeatureFlags
{
    public Task<bool> IsEnabledAsync(string flagName, bool defaultValue, CancellationToken ct = default)
        => Task.FromResult(defaultValue);
}
