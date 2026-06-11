namespace MyProperty.Application.Stats.Queries.GetPublicStats;

/// <summary>
/// Loads the publicly visible landing-page stats. Takes no parameters —
/// the data is a global aggregate, not scoped to the calling user.
/// </summary>
public sealed record GetPublicStatsQuery();
