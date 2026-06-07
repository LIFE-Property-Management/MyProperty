using FluentValidation;

namespace MyProperty.Application.Invites.Commands.AcceptInvite;

public sealed class AcceptInviteValidator : AbstractValidator<AcceptInviteCommand>
{
    public AcceptInviteValidator()
    {
        RuleFor(x => x.Token)
            .NotEmpty().WithMessage("Token is required.")
            .Length(20, 100).WithMessage("Token length is invalid.")
            .Matches("^[A-Za-z0-9_-]+$").WithMessage("Token must be URL-safe base64.");

        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("First name is required.")
            .MaximumLength(100).WithMessage("First name must be 100 characters or fewer.");

        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("Last name is required.")
            .MaximumLength(100).WithMessage("Last name must be 100 characters or fewer.");

        RuleFor(x => x.Phone)
            .Matches(@"^\+?[0-9\s\-()]{7,20}$")
            .WithMessage("Phone number format is invalid.")
            .When(x => !string.IsNullOrEmpty(x.Phone));

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required.")
            .MinimumLength(8).WithMessage("Password must be at least 8 characters.")
            .Matches("[0-9]").WithMessage("Password must contain at least one digit.")
            .Matches("[A-Za-z]").WithMessage("Password must contain at least one letter.");
    }
}
