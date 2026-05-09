using FluentValidation;

namespace MyProperty.Application.Landlord.Queries.GetLandlordDashboard;

public sealed class GetLandlordDashboardValidator : AbstractValidator<GetLandlordDashboardQuery>
{
    public GetLandlordDashboardValidator()
    {
        // LandlordId is server-resolved from claims, not user-supplied — but the
        // validator exists for consistency and to catch programming errors.
        RuleFor(x => x.LandlordId).NotEmpty();
    }
}
