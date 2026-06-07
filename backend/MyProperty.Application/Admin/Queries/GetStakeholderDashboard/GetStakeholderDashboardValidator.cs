using FluentValidation;

namespace MyProperty.Application.Admin.Queries.GetStakeholderDashboard;

/// <summary>
/// No inputs to validate — the query is parameterless. Present for consistency
/// with the rest of the CQRS surface (mirrors <c>GetLandlordDashboardValidator</c>),
/// so the handler's <c>EnsureValidAsync</c> call has a registered validator.
/// </summary>
public sealed class GetStakeholderDashboardValidator : AbstractValidator<GetStakeholderDashboardQuery>
{
    public GetStakeholderDashboardValidator()
    {
    }
}
