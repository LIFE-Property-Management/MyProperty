using FluentValidation;

namespace MyProperty.Application.Invites.Commands.CreateInvite;

public sealed class CreateInviteValidator : AbstractValidator<CreateInviteCommand>
{
    public CreateInviteValidator()
    {
        RuleFor(x => x.PropertyId)
            .NotEmpty();

        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress()
            .MaximumLength(256);

        RuleFor(x => x.FirstName)
            .NotEmpty()
            .MaximumLength(100);

        RuleFor(x => x.LastName)
            .NotEmpty()
            .MaximumLength(100);

        RuleFor(x => x.ProposedStartDate)
            .Must(d => d >= DateOnly.FromDateTime(DateTime.UtcNow.Date))
            .WithMessage("ProposedStartDate cannot be in the past.");

        RuleFor(x => x.ProposedEndDate)
            .GreaterThan(x => x.ProposedStartDate)
            .WithMessage("ProposedEndDate must be after ProposedStartDate.");

        RuleFor(x => x.ProposedMonthlyRent)
            .GreaterThan(0m)
            .LessThan(1_000_000m);

        RuleFor(x => x.Currency)
            .NotEmpty()
            .Length(3)
            .Matches("^[A-Z]{3}$")
            .WithMessage("Currency must be a 3-letter uppercase ISO 4217 code.");
    }
}
