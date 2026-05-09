using FluentValidation;

namespace MyProperty.Application.Payments.Commands.ConfirmPayment;

public sealed class ConfirmPaymentValidator : AbstractValidator<ConfirmPaymentCommand>
{
    public ConfirmPaymentValidator()
    {
        RuleFor(x => x.PaymentId)
            .NotEmpty().WithMessage("PaymentId is required.");
    }
}
