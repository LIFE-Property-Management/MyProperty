using FluentValidation.TestHelper;
using MyProperty.Application.Landlord.Queries.GetLandlordDashboard;

namespace MyProperty.Tests.Unit.Validators;

public sealed class GetLandlordDashboardValidatorTests
{
    private readonly GetLandlordDashboardValidator _sut = new();

    [Fact]
    public void NonEmptyId_passes()
    {
        _sut.TestValidate(new GetLandlordDashboardQuery(Guid.NewGuid()))
            .ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void EmptyId_fails()
    {
        _sut.TestValidate(new GetLandlordDashboardQuery(Guid.Empty))
            .ShouldHaveValidationErrorFor(x => x.LandlordId);
    }
}
