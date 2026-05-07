using FluentValidation;

namespace MyProperty.Application.Payments.Commands.RejectPayment;

public sealed class RejectPaymentValidator : AbstractValidator<RejectPaymentCommand>
{
    public RejectPaymentValidator()
    {
        RuleFor(x => x.PaymentId)
            .NotEmpty().WithMessage("PaymentId is required.");

        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Rejection reason is required.")
            .Must(r => !string.IsNullOrWhiteSpace(r))
                .WithMessage("Rejection reason cannot be whitespace only.")
            .MinimumLength(10).WithMessage("Rejection reason must be at least 10 characters.")
            .MaximumLength(500).WithMessage("Rejection reason must be 500 characters or fewer.");
    }
}
