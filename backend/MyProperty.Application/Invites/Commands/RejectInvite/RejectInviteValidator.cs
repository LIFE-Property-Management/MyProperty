using FluentValidation;

namespace MyProperty.Application.Invites.Commands.RejectInvite;

public sealed class RejectInviteValidator : AbstractValidator<RejectInviteCommand>
{
    public RejectInviteValidator()
    {
        RuleFor(x => x.Token)
            .NotEmpty().WithMessage("Token is required.")
            .Length(20, 100).WithMessage("Token length is invalid.")
            .Matches("^[A-Za-z0-9_-]+$").WithMessage("Token must be URL-safe base64.");
    }
}
