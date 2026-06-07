namespace MyProperty.Application.Landlord.Queries.GetUpcomingPayments;

public sealed record GetUpcomingPaymentsQuery(Guid LandlordId, int Page, int PageSize);
