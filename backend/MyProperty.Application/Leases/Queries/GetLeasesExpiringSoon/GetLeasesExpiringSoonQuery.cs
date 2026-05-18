namespace MyProperty.Application.Leases.Queries.GetLeasesExpiringSoon;

public sealed record GetLeasesExpiringSoonQuery(int DaysThreshold = 30);
