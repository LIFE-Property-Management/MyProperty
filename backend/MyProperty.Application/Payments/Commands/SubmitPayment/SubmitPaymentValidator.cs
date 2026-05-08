using FluentValidation;
using MyProperty.Domain.Enums;

namespace MyProperty.Application.Payments.Commands.SubmitPayment;

public sealed class SubmitPaymentValidator : AbstractValidator<SubmitPaymentCommand>
{
    // Business rule: receipts are capped at 5 MB. Kestrel applies a 6 MB
    // RequestSizeLimit on the controller action as a hard outer cap; this
    // validator enforces the strict business limit and produces the user-
    // facing 400 with the standard ValidationProblemDetails envelope.
    private const long MaxFileSizeBytes = 5L * 1024 * 1024;

    private static readonly string[] AllowedContentTypes =
    [
        "image/jpeg",
        "image/png",
        "application/pdf",
    ];

    public SubmitPaymentValidator()
    {
        RuleFor(x => x.PaymentId)
            .NotEmpty().WithMessage("PaymentId is required.");

        RuleFor(x => x.Method)
            .IsInEnum().WithMessage("Method must be a valid PaymentMethod value.");

        RuleFor(x => x.Notes)
            .MaximumLength(500).WithMessage("Notes must be 500 characters or fewer.");

        // Method/file consistency rules — see SubmitPaymentCommand remarks.
        // ReceiptUpload requires a file; ManualRequest forbids one. Both
        // failures map to 400 via the shared validation pipeline.
        When(x => x.Method == PaymentMethod.ReceiptUpload, () =>
        {
            RuleFor(x => x.FileStream)
                .NotNull()
                .WithMessage("A receipt file is required when Method is ReceiptUpload.");

            RuleFor(x => x.FileName)
                .NotEmpty()
                .WithMessage("FileName is required when Method is ReceiptUpload.")
                .MaximumLength(255)
                .WithMessage("FileName must be 255 characters or fewer.");

            RuleFor(x => x.ContentType)
                .NotEmpty()
                .WithMessage("ContentType is required when Method is ReceiptUpload.")
                .Must(ct => ct is not null && AllowedContentTypes.Contains(ct))
                .WithMessage($"ContentType must be one of: {string.Join(", ", AllowedContentTypes)}.");

            RuleFor(x => x.FileSizeBytes)
                .NotNull()
                .WithMessage("FileSizeBytes is required when Method is ReceiptUpload.")
                .GreaterThan(0L)
                .WithMessage("FileSizeBytes must be greater than zero.")
                .LessThanOrEqualTo(MaxFileSizeBytes)
                .WithMessage($"File size must not exceed {MaxFileSizeBytes / (1024 * 1024)} MB.");
        });

        When(x => x.Method == PaymentMethod.ManualRequest, () =>
        {
            RuleFor(x => x.FileStream)
                .Null()
                .WithMessage("A file must not be attached when Method is ManualRequest.");

            RuleFor(x => x.FileName)
                .Empty()
                .WithMessage("FileName must be empty when Method is ManualRequest.");

            RuleFor(x => x.ContentType)
                .Empty()
                .WithMessage("ContentType must be empty when Method is ManualRequest.");

            RuleFor(x => x.FileSizeBytes)
                .Null()
                .WithMessage("FileSizeBytes must be null when Method is ManualRequest.");
        });
    }
}
