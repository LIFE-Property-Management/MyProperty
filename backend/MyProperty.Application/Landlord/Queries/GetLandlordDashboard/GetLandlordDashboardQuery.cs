namespace MyProperty.Application.Landlord.Queries.GetLandlordDashboard;

/// <summary>Loads the landlord dashboard for the supplied landlord.</summary>
public sealed record GetLandlordDashboardQuery(Guid LandlordId);
