using FluentValidation;

namespace MyProperty.Application.Invites.Queries.GetLandlordInvites;

public sealed class GetLandlordInvitesValidator : AbstractValidator<GetLandlordInvitesQuery>
{
    public GetLandlordInvitesValidator()
    {
        RuleFor(x => x.Page).GreaterThan(0);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
        RuleFor(x => x.StatusFilter).IsInEnum().When(x => x.StatusFilter.HasValue);
    }
}
