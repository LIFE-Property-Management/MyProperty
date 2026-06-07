using FluentValidation.TestHelper;
using MyProperty.Application.Payments.Commands.CreatePayment;

namespace MyProperty.Tests.Unit.Validators;

public sealed class CreatePaymentValidatorTests
{
    private readonly CreatePaymentValidator _sut = new();

    private static CreatePaymentCommand Valid(
        Guid? leaseId = null,
        decimal? amount = null,
        string? currency = null,
        DateOnly? dueDate = null) =>
        new(
            LeaseId: leaseId ?? Guid.NewGuid(),
            Amount: amount ?? 1000m,
            Currency: currency ?? "EUR",
            DueDate: dueDate ?? DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(30));

    [Fact]
    public void HappyPath_passes()
    {
        _sut.TestValidate(Valid()).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void EmptyLeaseId_fails()
    {
        _sut.TestValidate(Valid(leaseId: Guid.Empty))
            .ShouldHaveValidationErrorFor(x => x.LeaseId);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(1_000_000)]
    [InlineData(2_000_000)]
    public void AmountOutOfRange_fails(decimal amount)
    {
        _sut.TestValidate(Valid(amount: amount))
            .ShouldHaveValidationErrorFor(x => x.Amount);
    }

    [Theory]
    [InlineData(0.01)]
    [InlineData(1000)]
    [InlineData(999_999.99)]
    public void AmountInRange_passes(decimal amount)
    {
        _sut.TestValidate(Valid(amount: amount))
            .ShouldNotHaveValidationErrorFor(x => x.Amount);
    }

    [Theory]
    [InlineData("eur")]   // lowercase
    [InlineData("EU")]    // too short
    [InlineData("EURO")]  // too long
    [InlineData("E1R")]   // not letters
    [InlineData("")]
    public void InvalidCurrency_fails(string currency)
    {
        _sut.TestValidate(Valid(currency: currency))
            .ShouldHaveValidationErrorFor(x => x.Currency);
    }

    [Theory]
    [InlineData("EUR")]
    [InlineData("USD")]
    [InlineData("GBP")]
    public void ValidCurrency_passes(string currency)
    {
        _sut.TestValidate(Valid(currency: currency))
            .ShouldNotHaveValidationErrorFor(x => x.Currency);
    }

    [Fact]
    public void DefaultDueDate_fails()
    {
        _sut.TestValidate(Valid(dueDate: default(DateOnly)))
            .ShouldHaveValidationErrorFor(x => x.DueDate);
    }
}
