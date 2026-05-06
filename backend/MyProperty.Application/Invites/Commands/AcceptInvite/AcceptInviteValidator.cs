using FluentValidation;

namespace MyProperty.Application.Invites.Commands.AcceptInvite;

public sealed class AcceptInviteValidator : AbstractValidator<AcceptInviteCommand>
{
    public AcceptInviteValidator()
    {
        RuleFor(x => x.Token)
            .NotEmpty()
            .Length(20, 100)
            .Matches("^[A-Za-z0-9_-]+$")
            .WithMessage("Token must be URL-safe base64.");
    }
}
