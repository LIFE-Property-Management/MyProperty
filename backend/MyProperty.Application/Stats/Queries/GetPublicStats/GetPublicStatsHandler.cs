using FluentValidation;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;

namespace MyProperty.Application.Stats.Queries.GetPublicStats;

public sealed class GetPublicStatsHandler(
    IValidator<GetPublicStatsQuery> validator,
    IPublicStatsRepository repository)
{
    public async Task<PublicStatsDto> Handle(GetPublicStatsQuery query, CancellationToken ct)
    {
        await validator.EnsureValidAsync(query, ct);
        return await repository.GetAsync(ct);
    }
}
