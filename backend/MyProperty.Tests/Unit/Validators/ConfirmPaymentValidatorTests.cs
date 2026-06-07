using FluentValidation.TestHelper;
using MyProperty.Application.Payments.Commands.ConfirmPayment;

namespace MyProperty.Tests.Unit.Validators;

public sealed class ConfirmPaymentValidatorTests
{
    private readonly ConfirmPaymentValidator _sut = new();

    [Fact]
    public void HappyPath_passes()
    {
        _sut.TestValidate(new ConfirmPaymentCommand(Guid.NewGuid()))
            .ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void EmptyPaymentId_fails()
    {
        _sut.TestValidate(new ConfirmPaymentCommand(Guid.Empty))
            .ShouldHaveValidationErrorFor(x => x.PaymentId);
    }
}
