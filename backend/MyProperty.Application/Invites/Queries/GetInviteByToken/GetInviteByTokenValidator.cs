using FluentValidation;

namespace MyProperty.Application.Invites.Queries.GetInviteByToken;

public sealed class GetInviteByTokenValidator : AbstractValidator<GetInviteByTokenQuery>
{
    public GetInviteByTokenValidator()
    {
        RuleFor(x => x.Token)
            .NotEmpty().WithMessage("Token is required.")
            .Length(20, 100).WithMessage("Token length is invalid.")
            .Matches("^[A-Za-z0-9_-]+$").WithMessage("Token must be URL-safe base64.");
    }
}
