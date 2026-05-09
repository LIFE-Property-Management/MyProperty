using System.Net;
using System.Net.Http.Json;
using MyProperty.Application.Health;
using MyProperty.Tests.Integration.Fixtures;

namespace MyProperty.Tests.Integration;

[Collection(ApiCollection.Name)]
public sealed class HealthEndpointTests(ApiFixture fixture)
{
    [Fact]
    public async Task Health_returns_ok_anonymously()
    {
        var client = fixture.CreateClient();

        var resp = await client.GetAsync("/api/v1/health");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        var body = await resp.Content.ReadFromJsonAsync<HealthResponse>();
        Assert.NotNull(body);
        Assert.Equal("ok", body!.Status);
    }
}
