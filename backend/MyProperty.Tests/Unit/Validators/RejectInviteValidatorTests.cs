using FluentValidation.TestHelper;
using MyProperty.Application.Invites.Commands.RejectInvite;

namespace MyProperty.Tests.Unit.Validators;

public sealed class RejectInviteValidatorTests
{
    private readonly RejectInviteValidator _sut = new();

    [Fact]
    public void ValidToken_passes()
    {
        _sut.TestValidate(new RejectInviteCommand("aB-cD_eF1234567890ABCDE"))
            .ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData("short")]
    [InlineData("contains spaces")]
    public void Invalid_fails(string token)
    {
        _sut.TestValidate(new RejectInviteCommand(token))
            .ShouldHaveValidationErrorFor(x => x.Token);
    }
}
