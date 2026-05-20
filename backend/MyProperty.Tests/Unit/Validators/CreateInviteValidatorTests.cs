using FluentValidation.TestHelper;
using MyProperty.Application.Invites.Commands.CreateInvite;

namespace MyProperty.Tests.Unit.Validators;

public sealed class CreateInviteValidatorTests
{
    private readonly CreateInviteValidator _sut = new();

    private static CreateInviteCommand Valid(
        string? email = null,
        string? firstName = null,
        string? lastName = null,
        DateOnly? start = null,
        DateOnly? end = null,
        decimal? rent = null,
        string? currency = null,
        Guid? propertyId = null) =>
        new(
            PropertyId: propertyId ?? Guid.NewGuid(),
            Email: email ?? "tenant@example.com",
            FirstName: firstName ?? "Ada",
            LastName: lastName ?? "Lovelace",
            ProposedStartDate: start ?? DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(1),
            ProposedEndDate: end ?? DateOnly.FromDateTime(DateTime.UtcNow.Date).AddYears(1),
            ProposedMonthlyRent: rent ?? 850m,
            Currency: currency ?? "EUR");

    [Fact]
    public void HappyPath_passes()
    {
        _sut.TestValidate(Valid()).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void EmptyPropertyId_fails()
    {
        _sut.TestValidate(Valid(propertyId: Guid.Empty))
            .ShouldHaveValidationErrorFor(x => x.PropertyId);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    [InlineData("missing-at-symbol.com")]
    public void InvalidEmail_fails(string email)
    {
        _sut.TestValidate(Valid(email: email))
            .ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void EmailTooLong_fails()
    {
        // local part (260) + "@x.io" (5) = 265 chars, exceeds MaxLength(256).
        var local = new string('a', 260);
        _sut.TestValidate(Valid(email: $"{local}@x.io"))
            .ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void EmptyFirstName_fails()
    {
        _sut.TestValidate(Valid(firstName: ""))
            .ShouldHaveValidationErrorFor(x => x.FirstName);
    }

    [Fact]
    public void FirstNameTooLong_fails()
    {
        _sut.TestValidate(Valid(firstName: new string('a', 101)))
            .ShouldHaveValidationErrorFor(x => x.FirstName);
    }

    [Fact]
    public void StartDateInPast_fails()
    {
        _sut.TestValidate(Valid(start: DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(-1)))
            .ShouldHaveValidationErrorFor(x => x.ProposedStartDate);
    }

    [Fact]
    public void StartDateToday_passes()
    {
        _sut.TestValidate(Valid(start: DateOnly.FromDateTime(DateTime.UtcNow.Date)))
            .ShouldNotHaveValidationErrorFor(x => x.ProposedStartDate);
    }

    [Fact]
    public void EndDateNotAfterStart_fails()
    {
        var start = DateOnly.FromDateTime(DateTime.UtcNow.Date).AddDays(10);
        _sut.TestValidate(Valid(start: start, end: start))
            .ShouldHaveValidationErrorFor(x => x.ProposedEndDate);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(1_000_000)]
    public void RentOutOfRange_fails(decimal rent)
    {
        _sut.TestValidate(Valid(rent: rent))
            .ShouldHaveValidationErrorFor(x => x.ProposedMonthlyRent);
    }

    [Theory]
    [InlineData("eur")]      // lowercase
    [InlineData("EU")]       // too short
    [InlineData("EURO")]     // too long
    [InlineData("E1R")]      // not letters
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
}
