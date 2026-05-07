using System.Security.Claims;
using MyProperty.Api.Auth;

namespace MyProperty.Tests.Unit.Auth;

public sealed class KeycloakRolesTransformerTests
{
    private readonly KeycloakRolesTransformer _sut = new();

    private static ClaimsPrincipal Authenticated(params Claim[] claims)
    {
        var identity = new ClaimsIdentity(claims, authenticationType: "Test");
        return new ClaimsPrincipal(identity);
    }

    [Fact]
    public async Task Projects_realm_roles_onto_role_claims()
    {
        var principal = Authenticated(
            new Claim("sub", "abc"),
            new Claim("realm_access", """{"roles":["Tenant","Landlord"]}"""));

        var result = await _sut.TransformAsync(principal);

        Assert.Contains(result.Claims, c => c.Type == ClaimTypes.Role && c.Value == "Tenant");
        Assert.Contains(result.Claims, c => c.Type == ClaimTypes.Role && c.Value == "Landlord");
        Assert.True(result.IsInRole("Tenant"));
        Assert.True(result.IsInRole("Landlord"));
    }

    [Fact]
    public async Task Idempotent_when_role_claims_already_present()
    {
        var principal = Authenticated(
            new Claim("sub", "abc"),
            new Claim(ClaimTypes.Role, "Tenant"),
            new Claim("realm_access", """{"roles":["Landlord"]}"""));

        var result = await _sut.TransformAsync(principal);

        // Tenant role was pre-existing; Landlord should NOT have been added because
        // the transformer skipped re-parsing once it saw an existing Role claim.
        Assert.True(result.IsInRole("Tenant"));
        Assert.False(result.IsInRole("Landlord"));
    }

    [Fact]
    public async Task Unauthenticated_principal_is_returned_unchanged()
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity()); // not authenticated
        var result = await _sut.TransformAsync(principal);
        Assert.Empty(result.FindAll(ClaimTypes.Role));
    }

    [Fact]
    public async Task Missing_realm_access_claim_is_a_noop()
    {
        var principal = Authenticated(new Claim("sub", "abc"));
        var result = await _sut.TransformAsync(principal);
        Assert.Empty(result.FindAll(ClaimTypes.Role));
    }

    [Fact]
    public async Task Realm_access_without_roles_array_is_a_noop()
    {
        var principal = Authenticated(
            new Claim("sub", "abc"),
            new Claim("realm_access", """{"other":"value"}"""));

        var result = await _sut.TransformAsync(principal);
        Assert.Empty(result.FindAll(ClaimTypes.Role));
    }

    [Fact]
    public async Task Skips_blank_role_values()
    {
        var principal = Authenticated(
            new Claim("sub", "abc"),
            new Claim("realm_access", """{"roles":["Tenant","","   "]}"""));

        var result = await _sut.TransformAsync(principal);
        Assert.Single(result.FindAll(ClaimTypes.Role));
        Assert.True(result.IsInRole("Tenant"));
    }
}
