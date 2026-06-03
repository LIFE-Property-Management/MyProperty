namespace MyProperty.Application.Common.FeatureFlags;

/// <summary>
/// Application-layer abstraction over the feature-flag provider. Call sites
/// depend on this rather than the Unleash SDK directly, so the Application
/// project stays free of infrastructure references (same rule as
/// <see cref="MyProperty.Application.Common.Interfaces.IBackgroundJobQueue"/>).
/// Implementations MUST be safe by default and MUST NOT throw if the flag
/// backend is unreachable — they return the supplied default value.
/// </summary>
public interface IFeatureFlags
{
    /// <summary>
    /// Evaluate a boolean feature flag. Returns <paramref name="defaultValue"/>
    /// when the flag is unknown or the provider cannot be reached.
    /// </summary>
    Task<bool> IsEnabledAsync(string flagName, bool defaultValue, CancellationToken ct = default);
}
