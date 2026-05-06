using FluentValidation;

namespace MyProperty.Application.Invites.Commands.CreateInvite;

public sealed class CreateInviteValidator : AbstractValidator<CreateInviteCommand>
{
    public CreateInviteValidator()
    {
        RuleFor(x => x.PropertyId)
            .NotEmpty().WithMessage("PropertyId is required.");;

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("Email is invalid.")
            .MaximumLength(256).WithMessage("Email must not exceed 256 characters.");

        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("FirstName is required.")
            .MaximumLength(100).WithMessage("FirstName must not exceed 100 characters.");

        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("LastName is required.")
            .MaximumLength(100).WithMessage("LastName must not exceed 100 characters.");

        RuleFor(x => x.ProposedStartDate)
            .Must(d => d >= DateOnly.FromDateTime(DateTime.UtcNow.Date))
            .WithMessage("ProposedStartDate cannot be in the past.");

        RuleFor(x => x.ProposedEndDate)
            .GreaterThan(x => x.ProposedStartDate)
            .WithMessage("ProposedEndDate must be after ProposedStartDate.");

        RuleFor(x => x.ProposedMonthlyRent)
            .GreaterThan(0m).WithMessage("ProposedMonthlyRent must be greater than zero.")
            .LessThan(1_000_000m).WithMessage("ProposedMonthlyRent must be less than or equal to 1,000,000.");

        RuleFor(x => x.Currency)
            .NotEmpty().WithMessage("Currency is required.")
            .Length(3).WithMessage("Currency must be 3 characters long.")
            .Matches("^[A-Z]{3}$").WithMessage("Currency must be a 3-letter uppercase ISO 4217 code.");
    }
}
