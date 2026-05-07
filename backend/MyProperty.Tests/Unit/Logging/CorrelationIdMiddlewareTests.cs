using Microsoft.AspNetCore.Http;
using MyProperty.Api.Logging;

namespace MyProperty.Tests.Unit.Logging;

public sealed class CorrelationIdMiddlewareTests
{
    private const string Header = "X-Correlation-Id";

    private static async Task<(HttpContext ctx, string echoed)> Invoke(string? incoming)
    {
        var ctx = new DefaultHttpContext();
        if (incoming is not null) ctx.Request.Headers[Header] = incoming;

        var sut = new CorrelationIdMiddleware(_ => Task.CompletedTask);
        await sut.InvokeAsync(ctx);

        return (ctx, ctx.Response.Headers[Header].ToString());
    }

    [Fact]
    public async Task Generates_correlation_id_when_header_absent()
    {
        var (_, echoed) = await Invoke(incoming: null);

        Assert.False(string.IsNullOrEmpty(echoed));
        Assert.Equal(32, echoed.Length); // Guid.NewGuid().ToString("N") is 32 hex chars
        Assert.True(echoed.All(char.IsAsciiLetterOrDigit));
    }

    [Fact]
    public async Task Echoes_valid_incoming_correlation_id()
    {
        var (_, echoed) = await Invoke("abc123XYZ");
        Assert.Equal("abc123XYZ", echoed);
    }

    [Theory]
    [InlineData("has-dashes-not-alphanumeric")]
    [InlineData("contains spaces")]
    [InlineData("emoji-😀-id")]
    public async Task Rejects_malformed_header_and_generates_new_id(string incoming)
    {
        var (_, echoed) = await Invoke(incoming);

        Assert.NotEqual(incoming, echoed);
        Assert.Equal(32, echoed.Length);
    }

    [Fact]
    public async Task Rejects_overly_long_header()
    {
        var tooLong = new string('a', 65);
        var (_, echoed) = await Invoke(tooLong);

        Assert.NotEqual(tooLong, echoed);
        Assert.Equal(32, echoed.Length);
    }
}
