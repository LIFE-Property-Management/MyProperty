using FluentValidation;

namespace MyProperty.Application.Leases.Queries.GetLeasesExpiringSoon;

public sealed class GetLeasesExpiringSoonValidator : AbstractValidator<GetLeasesExpiringSoonQuery>
{
    public GetLeasesExpiringSoonValidator()
    {
        RuleFor(x => x.LandlordId).NotEmpty();
        RuleFor(x => x.DaysThreshold).InclusiveBetween(1, 365);
    }
}
