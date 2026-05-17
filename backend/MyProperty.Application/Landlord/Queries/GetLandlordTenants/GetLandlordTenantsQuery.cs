namespace MyProperty.Application.Landlord.Queries.GetLandlordTenants;

public sealed record GetLandlordTenantsQuery(Guid LandlordId, int Page, int PageSize);
