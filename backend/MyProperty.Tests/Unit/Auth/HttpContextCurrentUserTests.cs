using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Moq;
using MyProperty.Api.Auth;

namespace MyProperty.Tests.Unit.Auth;

public sealed class HttpContextCurrentUserTests
{
    private static (HttpContextCurrentUser sut, Mock<IHttpContextAccessor> accessor) Build(
        ClaimsPrincipal? principal)
    {
        var ctx = new DefaultHttpContext();
        if (principal is not null) ctx.User = principal;

        var accessor = new Mock<IHttpContextAccessor>();
        accessor.SetupGet(a => a.HttpContext).Returns(ctx);

        return (new HttpContextCurrentUser(accessor.Object), accessor);
    }

    [Fact]
    public void Reads_sub_and_username_and_roles_from_principal()
    {
        var identity = new ClaimsIdentity(
        [
            new Claim("sub", "kc-sub-123"),
            new Claim(ClaimTypes.Role, "Tenant"),
            new Claim(ClaimTypes.Role, "Landlord"),
        ], authenticationType: "Bearer", nameType: "preferred_username", roleType: ClaimTypes.Role);
        identity.AddClaim(new Claim("preferred_username", "ada@example.com"));

        var (sut, _) = Build(new ClaimsPrincipal(identity));

        Assert.True(sut.IsAuthenticated);
        Assert.Equal("kc-sub-123", sut.KeycloakSubId);
        Assert.Equal("ada@example.com", sut.UserName);
        Assert.True(sut.IsInRole("Tenant"));
        Assert.True(sut.IsInRole("Landlord"));
        Assert.Equal(["Tenant", "Landlord"], sut.Roles);
    }

    [Fact]
    public void Anonymous_principal_reports_unauthenticated_and_no_roles()
    {
        var (sut, _) = Build(new ClaimsPrincipal(new ClaimsIdentity()));

        Assert.False(sut.IsAuthenticated);
        Assert.Null(sut.KeycloakSubId);
        Assert.Empty(sut.Roles);
        Assert.False(sut.IsInRole("Tenant"));
    }
}
