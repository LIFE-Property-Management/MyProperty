using FluentValidation;

namespace MyProperty.Application.Payments.Commands.CreatePayment;

public sealed class CreatePaymentValidator : AbstractValidator<CreatePaymentCommand>
{
    public CreatePaymentValidator()
    {
        RuleFor(x => x.LeaseId)
            .NotEmpty().WithMessage("LeaseId is required.");

        RuleFor(x => x.Amount)
            .GreaterThan(0).WithMessage("Amount must be greater than 0.")
            .LessThan(1_000_000m).WithMessage("Amount must be less than 1,000,000.");

        RuleFor(x => x.Currency)
            .NotEmpty().WithMessage("Currency is required.")
            .Length(3).WithMessage("Currency must be a 3-letter ISO 4217 code.")
            .Matches("^[A-Z]{3}$").WithMessage("Currency must be uppercase letters.");

        RuleFor(x => x.DueDate)
            .NotEqual(default(DateOnly)).WithMessage("DueDate is required.");
    }
}
