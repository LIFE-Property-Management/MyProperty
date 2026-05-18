using FluentValidation;

namespace MyProperty.Application.Landlord.Queries.GetLandlordTenants;

public sealed class GetLandlordTenantsValidator : AbstractValidator<GetLandlordTenantsQuery>
{
    public GetLandlordTenantsValidator()
    {
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}
