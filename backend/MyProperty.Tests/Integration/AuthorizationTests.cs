using System.Net;
using System.Net.Http.Json;
using MyProperty.Application.Users.Queries.GetMe;
using MyProperty.Tests.Integration.Fixtures;

namespace MyProperty.Tests.Integration;

/// <summary>
/// Verifies the auth pipeline end-to-end: tokens are minted by a real Keycloak
/// container and validated by the API's JWT bearer middleware against the
/// realm's JWKS endpoint. Role projection (realm_access.roles → ClaimTypes.Role)
/// is exercised by hitting policy-protected endpoints across the three roles.
/// </summary>
[Collection(ApiCollection.Name)]
public sealed class AuthorizationTests(ApiFixture fixture)
{
    [Fact]
    public async Task Anonymous_request_to_protected_endpoint_returns_401()
    {
        var client = fixture.CreateClient();

        var resp = await client.GetAsync("/api/v1/me");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Random_bearer_token_is_rejected()
    {
        var client = fixture.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", "not.a.real.jwt");

        var resp = await client.GetAsync("/api/v1/me");

        Assert.Equal(HttpStatusCode.Unauthorized, resp.StatusCode);
    }

    [Fact]
    public async Task Tenant_token_reaches_me_endpoint_with_role_claim()
    {
        var client = await fixture.CreateAuthenticatedClientAsync(ApiFixture.TenantEmail);

        var resp = await client.GetAsync("/api/v1/me");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var me = await resp.Content.ReadFromJsonAsync<MeDto>();
        Assert.NotNull(me);
        Assert.Equal(ApiFixture.TenantEmail, me!.Email);
        Assert.Contains("Tenant", me.Roles);
    }

    [Fact]
    public async Task Tenant_can_call_tenant_only_endpoint()
    {
        var client = await fixture.CreateAuthenticatedClientAsync(ApiFixture.TenantEmail);

        var resp = await client.GetAsync("/api/v1/me/tenant-only");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task Landlord_cannot_call_tenant_only_endpoint()
    {
        var client = await fixture.CreateAuthenticatedClientAsync(ApiFixture.LandlordEmail);

        var resp = await client.GetAsync("/api/v1/me/tenant-only");

        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task Landlord_can_reach_landlord_dashboard()
    {
        var client = await fixture.CreateAuthenticatedClientAsync(ApiFixture.LandlordEmail);

        var resp = await client.GetAsync("/api/v1/landlord/dashboard");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task Tenant_cannot_reach_landlord_dashboard()
    {
        var client = await fixture.CreateAuthenticatedClientAsync(ApiFixture.TenantEmail);

        var resp = await client.GetAsync("/api/v1/landlord/dashboard");

        Assert.Equal(HttpStatusCode.Forbidden, resp.StatusCode);
    }
}
