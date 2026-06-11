namespace MyProperty.Application.Stats.Queries.GetPublicStats;

public sealed record PublicStatsDto(
    decimal RentCollected,
    string Currency,
    int PropertiesManaged,
    int LandlordsOnboarded);
