namespace MyProperty.Application.Properties.Queries.GetLandlordProperties;

public sealed record GetLandlordPropertiesQuery(Guid LandlordId, int Page, int PageSize);
