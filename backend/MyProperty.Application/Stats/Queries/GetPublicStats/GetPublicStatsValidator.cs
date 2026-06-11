using FluentValidation;

namespace MyProperty.Application.Stats.Queries.GetPublicStats;

/// <summary>
/// No inputs to validate — the query is parameterless. Present so the
/// handler's <c>EnsureValidAsync</c> call has a registered validator.
/// </summary>
public sealed class GetPublicStatsValidator : AbstractValidator<GetPublicStatsQuery>
{
    public GetPublicStatsValidator()
    {
    }
}
