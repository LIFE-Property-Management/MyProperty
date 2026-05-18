using FluentValidation;

namespace MyProperty.Application.Leases.Queries.GetLandlordLeases;

public sealed class GetLandlordLeasesValidator : AbstractValidator<GetLandlordLeasesQuery>
{
    public GetLandlordLeasesValidator()
    {
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}
