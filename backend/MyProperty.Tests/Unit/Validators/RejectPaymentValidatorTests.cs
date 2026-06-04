using FluentValidation.TestHelper;
using MyProperty.Application.Payments.Commands.RejectPayment;

namespace MyProperty.Tests.Unit.Validators;

public sealed class RejectPaymentValidatorTests
{
    private readonly RejectPaymentValidator _sut = new();

    private static RejectPaymentCommand Valid(Guid? paymentId = null, string? reason = null) =>
        new(paymentId ?? Guid.NewGuid(), reason ?? "Receipt amount does not match the rent due.");

    [Fact]
    public void HappyPath_passes()
    {
        _sut.TestValidate(Valid()).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void EmptyPaymentId_fails()
    {
        _sut.TestValidate(Valid(paymentId: Guid.Empty))
            .ShouldHaveValidationErrorFor(x => x.PaymentId);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t\n")]
    public void EmptyOrWhitespaceReason_fails(string reason)
    {
        _sut.TestValidate(Valid(reason: reason))
            .ShouldHaveValidationErrorFor(x => x.Reason);
    }

    [Theory]
    [InlineData("too short")]   // 9 chars
    [InlineData("nine char")]   // 9 chars
    public void ReasonUnderMinLength_fails(string reason)
    {
        _sut.TestValidate(Valid(reason: reason))
            .ShouldHaveValidationErrorFor(x => x.Reason);
    }

    [Fact]
    public void ReasonAtMinLength_passes()
    {
        _sut.TestValidate(Valid(reason: new string('a', 10)))
            .ShouldNotHaveValidationErrorFor(x => x.Reason);
    }

    [Fact]
    public void ReasonTooLong_fails()
    {
        _sut.TestValidate(Valid(reason: new string('a', 501)))
            .ShouldHaveValidationErrorFor(x => x.Reason);
    }
}
