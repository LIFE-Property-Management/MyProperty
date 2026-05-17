namespace MyProperty.Application.Leases.Queries.GetLeasesExpiringSoon;

public sealed record GetLeasesExpiringSoonQuery(Guid LandlordId, int DaysThreshold = 30);
