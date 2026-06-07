using FluentValidation;

namespace MyProperty.Application.Landlord.Queries.GetUpcomingPayments;

public sealed class GetUpcomingPaymentsValidator : AbstractValidator<GetUpcomingPaymentsQuery>
{
    public GetUpcomingPaymentsValidator()
    {
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}
