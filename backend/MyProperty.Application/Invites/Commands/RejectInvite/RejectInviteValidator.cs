using FluentValidation;

namespace MyProperty.Application.Invites.Commands.RejectInvite;

public sealed class RejectInviteValidator : AbstractValidator<RejectInviteCommand>
{
    public RejectInviteValidator()
    {
        RuleFor(x => x.Token)
            .NotEmpty()
            .Length(20, 100)
            .Matches("^[A-Za-z0-9_-]+$")
            .WithMessage("Token must be URL-safe base64.");
    }
}
