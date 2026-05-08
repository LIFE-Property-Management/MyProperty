using FluentValidation;

namespace MyProperty.Application.Payments.Commands.SubmitPayment;

public sealed class SubmitPaymentValidator : AbstractValidator<SubmitPaymentCommand>
{
    public SubmitPaymentValidator()
    {
        RuleFor(x => x.PaymentId)
            .NotEmpty().WithMessage("PaymentId is required.");

        RuleFor(x => x.Method)
            .IsInEnum().WithMessage("Method must be a valid PaymentMethod value.");

        RuleFor(x => x.Notes)
            .MaximumLength(500).WithMessage("Notes must be 500 characters or fewer.");
    }
}
