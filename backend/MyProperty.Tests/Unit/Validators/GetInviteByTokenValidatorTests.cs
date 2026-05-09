using FluentValidation.TestHelper;
using MyProperty.Application.Invites.Queries.GetInviteByToken;

namespace MyProperty.Tests.Unit.Validators;

public sealed class GetInviteByTokenValidatorTests
{
    private readonly GetInviteByTokenValidator _sut = new();

    [Fact]
    public void ValidToken_passes()
    {
        _sut.TestValidate(new GetInviteByTokenQuery("aB-cD_eF1234567890ABCDE"))
            .ShouldNotHaveAnyValidationErrors();
    }

    [Theory]
    [InlineData("")]
    [InlineData("short")]
    [InlineData("token+with/plusandslash==")]
    public void Invalid_fails(string token)
    {
        _sut.TestValidate(new GetInviteByTokenQuery(token))
            .ShouldHaveValidationErrorFor(x => x.Token);
    }
}
