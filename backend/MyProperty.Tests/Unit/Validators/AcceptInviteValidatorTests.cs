using FluentValidation.TestHelper;
using MyProperty.Application.Invites.Commands.AcceptInvite;

namespace MyProperty.Tests.Unit.Validators;

public sealed class AcceptInviteValidatorTests
{
    private readonly AcceptInviteValidator _sut = new();

    private static AcceptInviteCommand Valid(
        string token = "aB-cD_eF1234567890ABCDE",
        string firstName = "Ada",
        string lastName = "Lovelace",
        string? phone = null,
        string password = "Password1") =>
        new(token, firstName, lastName, phone, password);

    [Fact]
    public void ValidCommand_passes()
    {
        _sut.TestValidate(Valid()).ShouldNotHaveAnyValidationErrors();
    }

    // ── Token ───────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void EmptyToken_fails(string? token)
    {
        _sut.TestValidate(Valid(token: token!))
            .ShouldHaveValidationErrorFor(x => x.Token);
    }

    [Fact]
    public void TooShortToken_fails()
    {
        _sut.TestValidate(Valid(token: new string('a', 19)))
            .ShouldHaveValidationErrorFor(x => x.Token);
    }

    [Fact]
    public void TooLongToken_fails()
    {
        _sut.TestValidate(Valid(token: new string('a', 101)))
            .ShouldHaveValidationErrorFor(x => x.Token);
    }

    [Theory]
    [InlineData("token+with/plusandslash==")]
    [InlineData("contains spaces in token")]
    [InlineData("emoji-token-😀-not-allowed")]
    public void NonUrlSafeChars_fails(string token)
    {
        _sut.TestValidate(Valid(token: token))
            .ShouldHaveValidationErrorFor(x => x.Token);
    }

    // ── Name fields ─────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void EmptyFirstName_fails(string? firstName)
    {
        _sut.TestValidate(Valid(firstName: firstName!))
            .ShouldHaveValidationErrorFor(x => x.FirstName);
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void EmptyLastName_fails(string? lastName)
    {
        _sut.TestValidate(Valid(lastName: lastName!))
            .ShouldHaveValidationErrorFor(x => x.LastName);
    }

    // ── Password ─────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("short1")]    // too short
    [InlineData("noodigits")]  // no digit
    [InlineData("12345678")]   // no letter
    public void WeakPassword_fails(string password)
    {
        _sut.TestValidate(Valid(password: password))
            .ShouldHaveValidationErrorFor(x => x.Password);
    }

    [Fact]
    public void PhoneOptional_validWhenAbsent()
    {
        _sut.TestValidate(Valid(phone: null)).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void PhoneOptional_invalidWhenMalformed()
    {
        _sut.TestValidate(Valid(phone: "not-a-phone!"))
            .ShouldHaveValidationErrorFor(x => x.Phone);
    }
}
