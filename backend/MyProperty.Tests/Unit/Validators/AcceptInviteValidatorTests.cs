using FluentValidation.TestHelper;
using MyProperty.Application.Invites.Commands.AcceptInvite;

namespace MyProperty.Tests.Unit.Validators;

public sealed class AcceptInviteValidatorTests
{
    private readonly AcceptInviteValidator _sut = new();

    [Fact]
    public void ValidUrlSafeBase64_passes()
    {
        _sut.TestValidate(new AcceptInviteCommand("aB-cD_eF1234567890ABCDE"))
            .ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public void EmptyToken_fails(string? token)
    {
        _sut.TestValidate(new AcceptInviteCommand(token!))
            .ShouldHaveValidationErrorFor(x => x.Token);
    }

    [Fact]
    public void TooShortToken_fails()
    {
        _sut.TestValidate(new AcceptInviteCommand(new string('a', 19)))
            .ShouldHaveValidationErrorFor(x => x.Token);
    }

    [Fact]
    public void TooLongToken_fails()
    {
        _sut.TestValidate(new AcceptInviteCommand(new string('a', 101)))
            .ShouldHaveValidationErrorFor(x => x.Token);
    }

    [Theory]
    [InlineData("token+with/plusandslash==")]   // base64 with non-URL-safe chars
    [InlineData("contains spaces in token")]
    [InlineData("emoji-token-😀-not-allowed")]
    public void NonUrlSafeChars_fails(string token)
    {
        _sut.TestValidate(new AcceptInviteCommand(token))
            .ShouldHaveValidationErrorFor(x => x.Token);
    }
}
