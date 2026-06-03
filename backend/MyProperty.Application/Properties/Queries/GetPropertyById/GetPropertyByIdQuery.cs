namespace MyProperty.Application.Properties.Queries.GetPropertyById;

public sealed record GetPropertyByIdQuery(Guid PropertyId, Guid LandlordId);
