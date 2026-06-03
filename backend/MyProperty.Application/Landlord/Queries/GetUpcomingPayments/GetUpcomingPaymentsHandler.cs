using MyProperty.Application.Common;
using MyProperty.Application.Common.Interfaces;

namespace MyProperty.Application.Landlord.Queries.GetUpcomingPayments;

public sealed class GetUpcomingPaymentsHandler(IPaymentRepository payments)
{
    public Task<PagedResult<UpcomingPaymentDto>> Handle(
        GetUpcomingPaymentsQuery query, CancellationToken ct) =>
        payments.GetUpcomingForLandlordAsync(query.LandlordId, query.Page, query.PageSize, ct);
}
