using System.Net;
using System.Text.Json;
using MyProperty.Tests.Integration.Fixtures;

namespace MyProperty.Tests.Integration;

[Collection(ApiCollection.Name)]
public sealed class HealthEndpointTests(ApiFixture fixture)
{
    // ── /live ────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Live_Returns200_WhenProcessIsUp()
    {
        var client = fixture.CreateClient();

        var resp = await client.GetAsync("/api/v1/health/live");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task Live_DoesNotRequireAuth()
    {
        var client = fixture.CreateClient();
        // No Authorization header set — anonymous request.
        var resp = await client.GetAsync("/api/v1/health/live");

        Assert.NotEqual(HttpStatusCode.Unauthorized, resp.StatusCode);
        Assert.NotEqual(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task Live_ResponseBody_HasNoCheckEntries()
    {
        var client = fixture.CreateClient();

        var resp = await client.GetAsync("/api/v1/health/live");
        var json = await ParseBodyAsync(resp);

        // /live runs no checks (Predicate = _ => false) so entries must be empty.
        var entries = json.RootElement.GetProperty("entries");
        Assert.Equal(JsonValueKind.Object, entries.ValueKind);
        Assert.Empty(entries.EnumerateObject());
    }

    // ── /ready ───────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Ready_Returns200_WhenPostgresIsReachable()
    {
        var client = fixture.CreateClient();

        var resp = await client.GetAsync("/api/v1/health/ready");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
    }

    [Fact]
    public async Task Ready_DoesNotRequireAuth()
    {
        var client = fixture.CreateClient();
        var resp = await client.GetAsync("/api/v1/health/ready");

        Assert.NotEqual(HttpStatusCode.Unauthorized, resp.StatusCode);
        Assert.NotEqual(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task Ready_ResponseBody_ContainsOnlyPostgresEntry()
    {
        var client = fixture.CreateClient();

        var resp = await client.GetAsync("/api/v1/health/ready");
        var json = await ParseBodyAsync(resp);

        // /ready predicate filters to tag "ready" — only the postgres check.
        var entries = json.RootElement.GetProperty("entries");
        var keys = entries.EnumerateObject().Select(p => p.Name).ToList();

        Assert.Single(keys);
        Assert.Contains("postgres", keys);
    }

    // ── /diagnostics ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Diagnostics_DoesNotRequireAuth()
    {
        var client = fixture.CreateClient();
        // No Authorization header — anonymous request.
        // Status code is intentionally not asserted: diagnostics may return 503
        // in environments lacking Redis/RabbitMQ (including this test fixture),
        // which is correct behaviour for a full-picture endpoint.
        var resp = await client.GetAsync("/api/v1/health/diagnostics");

        Assert.NotEqual(HttpStatusCode.Unauthorized, resp.StatusCode);
        Assert.NotEqual(HttpStatusCode.Forbidden, resp.StatusCode);
    }

    [Fact]
    public async Task Diagnostics_ResponseBody_IncludesAllRegisteredChecks()
    {
        var client = fixture.CreateClient();

        var resp = await client.GetAsync("/api/v1/health/diagnostics");
        var json = await ParseBodyAsync(resp);

        // All four checks must appear in the response regardless of their status.
        var entries = json.RootElement.GetProperty("entries");
        var keys = entries.EnumerateObject().Select(p => p.Name).ToList();

        Assert.Contains("postgres",      keys);
        Assert.Contains("redis",         keys);
        Assert.Contains("rabbitmq",      keys);
        Assert.Contains("keycloak-jwks", keys);
    }

    // ── helpers ──────────────────────────────────────────────────────────────────

    private static async Task<JsonDocument> ParseBodyAsync(HttpResponseMessage resp)
    {
        var content = await resp.Content.ReadAsStringAsync();
        return JsonDocument.Parse(content);
    }
}
