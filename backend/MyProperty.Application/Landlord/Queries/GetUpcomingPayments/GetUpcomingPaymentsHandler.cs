using FluentValidation;
using MyProperty.Application.Common;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;

namespace MyProperty.Application.Landlord.Queries.GetUpcomingPayments;

public sealed class GetUpcomingPaymentsHandler(
    IValidator<GetUpcomingPaymentsQuery> validator,
    IPaymentRepository payments)
{
    public async Task<PagedResult<UpcomingPaymentDto>> Handle(
        GetUpcomingPaymentsQuery query, CancellationToken ct)
    {
        await validator.EnsureValidAsync(query, ct);
        return await payments.GetUpcomingForLandlordAsync(
            query.LandlordId, query.Page, query.PageSize, ct);
    }
}
