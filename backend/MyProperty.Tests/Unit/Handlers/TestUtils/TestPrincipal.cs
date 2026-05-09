using System.Security.Claims;

namespace MyProperty.Tests.Unit.Handlers.TestUtils;

internal static class TestPrincipal
{
    public static ClaimsPrincipal Authenticated(string sub, string email = "user@example.com")
    {
        var identity = new ClaimsIdentity(
        [
            new Claim("sub", sub),
            new Claim("email", email),
        ], authenticationType: "Bearer");

        return new ClaimsPrincipal(identity);
    }
}
