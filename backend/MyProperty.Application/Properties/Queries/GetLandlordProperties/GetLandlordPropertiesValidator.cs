using FluentValidation;

namespace MyProperty.Application.Properties.Queries.GetLandlordProperties;

public sealed class GetLandlordPropertiesValidator : AbstractValidator<GetLandlordPropertiesQuery>
{
    public GetLandlordPropertiesValidator()
    {
        RuleFor(x => x.LandlordId).NotEmpty();
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}
