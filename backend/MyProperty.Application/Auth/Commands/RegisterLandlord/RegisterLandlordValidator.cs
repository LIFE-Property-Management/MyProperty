using FluentValidation;

namespace MyProperty.Application.Auth.Commands.RegisterLandlord;

public sealed class RegisterLandlordValidator : AbstractValidator<RegisterLandlordCommand>
{
    public RegisterLandlordValidator()
    {
        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("A valid email address is required.");

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
