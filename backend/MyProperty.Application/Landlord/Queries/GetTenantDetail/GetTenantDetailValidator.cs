using FluentValidation;

namespace MyProperty.Application.Landlord.Queries.GetTenantDetail;

public sealed class GetTenantDetailValidator : AbstractValidator<GetTenantDetailQuery>
{
    public GetTenantDetailValidator()
    {
        RuleFor(x => x.TenantId).NotEmpty();
    }
}
