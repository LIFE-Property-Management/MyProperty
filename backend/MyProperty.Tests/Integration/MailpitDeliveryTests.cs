using System.Text.Json;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using MyProperty.Application.Common.Email;
using MyProperty.Infrastructure.Email;

namespace MyProperty.Tests.Integration;

/// <summary>
/// Proves <see cref="MailKitEmailSender"/> actually delivers SMTP to Mailpit —
/// the same image (axllent/mailpit:v1.30.1) the local compose stack and the
/// project-02 cluster run. Deliberately narrow: it exercises the real MailKit →
/// SMTP path against a live server and asserts via Mailpit's REST API, without
/// the full API host or Hangfire (those are covered by InviteFlowTests, which
/// intercepts mail with RecordingBackgroundJobQueue).
///
/// No Docker-availability skip — this matches ApiFixture's fail-hard convention:
/// if Docker is absent the container fails to start and the test fails, same as
/// every other integration test in this project.
/// </summary>
public sealed class MailpitDeliveryTests : IAsyncLifetime
{
    private const ushort SmtpPort = 1025;
    private const ushort ApiPort = 8025;

    // Generic container (no dedicated Mailpit Testcontainers module). Both ports
    // get random host ports so the test never collides with a local Mailpit on
    // 1025/8025. Readiness is gated on Mailpit's documented /readyz endpoint.
    private readonly IContainer _mailpit = new ContainerBuilder()
        .WithImage("axllent/mailpit:v1.30.1")
        .WithPortBinding(SmtpPort, assignRandomHostPort: true)
        .WithPortBinding(ApiPort, assignRandomHostPort: true)
        .WithWaitStrategy(Wait.ForUnixContainer()
            .UntilHttpRequestIsSucceeded(request => request.ForPort(ApiPort).ForPath("/readyz")))
        .Build();

    public Task InitializeAsync() => _mailpit.StartAsync();

    public Task DisposeAsync() => _mailpit.DisposeAsync().AsTask();

    [Fact]
    public async Task MailKitEmailSender_delivers_message_to_Mailpit()
    {
        // Point SmtpOptions at the running container (plain SMTP, no TLS — the
        // internal hop the cluster also uses: backend/Keycloak → mailpit:1025).
        var options = Options.Create(new SmtpOptions
        {
            Host = _mailpit.Hostname,
            Port = _mailpit.GetMappedPublicPort(SmtpPort),
            UseStartTls = false,
            FromAddress = "no-reply@myproperty.works",
            FromName = "MyProperty",
        });
        var sender = new MailKitEmailSender(options, NullLogger<MailKitEmailSender>.Instance);

        var message = new EmailMessage(
            To: "tenant@example.com",
            Subject: "Mailpit delivery test",
            Body: "<p>Hello from MailKitEmailSender</p>",
            IsHtml: true);

        await sender.SendAsync(message, CancellationToken.None);

        // Assert delivery via Mailpit's REST API — the message we sent is the
        // single captured message, with matching from / to / subject.
        using var http = new HttpClient
        {
            BaseAddress = new Uri($"http://{_mailpit.Hostname}:{_mailpit.GetMappedPublicPort(ApiPort)}"),
        };

        using var response = await http.GetAsync("/api/v1/messages", CancellationToken.None);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(CancellationToken.None);
        using var doc = await JsonDocument.ParseAsync(stream, cancellationToken: CancellationToken.None);
        var root = doc.RootElement;

        Assert.Equal(1, root.GetProperty("total").GetInt32());

        var captured = root.GetProperty("messages")[0];
        Assert.Equal("Mailpit delivery test", captured.GetProperty("Subject").GetString());
        Assert.Equal("no-reply@myproperty.works", captured.GetProperty("From").GetProperty("Address").GetString());
        Assert.Equal("tenant@example.com", captured.GetProperty("To")[0].GetProperty("Address").GetString());
    }
}
