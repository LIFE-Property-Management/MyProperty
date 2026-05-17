namespace MyProperty.Application.Leases.Queries.GetLandlordLeases;

public sealed record GetLandlordLeasesQuery(Guid LandlordId, int Page, int PageSize);
