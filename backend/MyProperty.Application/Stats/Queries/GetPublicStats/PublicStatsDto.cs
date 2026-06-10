namespace MyProperty.Application.Stats.Queries.GetPublicStats;

public sealed record PublicStatsDto(
    decimal RentCollected,
    int PropertiesManaged,
    int LandlordsOnboarded);
