using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Messaging;

namespace MyProperty.Tests.Integration.Fixtures;

/// <summary>
/// <see cref="WebApplicationFactory{TEntryPoint}"/> for the MyProperty API:
/// points the API at the Testcontainers-hosted Postgres + Keycloak via
/// configuration overrides, swaps Redis-backed caching for an in-memory cache,
/// and replaces the Hangfire-backed job queue with a recording fake so tests
/// can assert on enqueued emails without a real broker.
/// </summary>
internal sealed class MyPropertyApiFactory(
    string postgresConnectionString,
    string keycloakAuthority) : WebApplicationFactory<Program>
{
    public RecordingBackgroundJobQueue Queue { get; } = new();
    public RecordingEventPublisher Events { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // "Development" so RequireHttpsMetadata=false on the JWT bearer scheme —
        // Testcontainers' Keycloak only exposes HTTP, and the production gate in
        // Program.cs deliberately permits HTTP metadata only in Development.
        builder.UseEnvironment("Development");

        builder.UseSetting("ConnectionStrings:Postgres", postgresConnectionString);
        builder.UseSetting("Keycloak:Authority", keycloakAuthority);

        // Redis cache options must satisfy ValidateDataAnnotations() at startup,
        // but the connection itself is never opened — we substitute IDistributedCache
        // with a memory-backed implementation below so RedisLandlordDashboardCache
        // operates against in-memory storage.
        builder.UseSetting("Cache:RedisConnection", "unused:6379");
        builder.UseSetting("Cache:InstancePrefix", "test:");
        builder.UseSetting("Cache:LandlordDashboardTtlSeconds", "60");

        // SMTP options also have data-annotation validation; Hangfire/SMTP are
        // never invoked in tests because we replace IBackgroundJobQueue below.
        builder.UseSetting("Smtp:Host", "test-smtp");
        builder.UseSetting("Smtp:Port", "25");
        builder.UseSetting("Smtp:UseStartTls", "false");
        builder.UseSetting("Smtp:FromAddress", "no-reply@test.local");
        builder.UseSetting("Smtp:FromName", "Test");

        builder.UseSetting("Invites:PortalBaseUrl", "http://test.local");
        builder.UseSetting("Invites:ExpiryDays", "7");

        // Disable RabbitMQ wiring for the suite — the Enabled flag short-circuits
        // both the connection provider and the consumer hosted service in
        // AddMessaging. The IEventPublisher we substitute below records calls
        // for assertions instead of the no-op publisher AddMessaging would
        // otherwise register.
        builder.UseSetting("RabbitMq:Enabled", "false");

        builder.ConfigureServices(services =>
        {
            // ── Cache ──────────────────────────────────────────────────────
            // Production registers Redis via AddStackExchangeRedisCache → IDistributedCache.
            // Replace with the in-memory variant; ILandlordDashboardCache (the consumer)
            // is unaware of the underlying transport.
            services.RemoveAll<IDistributedCache>();
            services.AddDistributedMemoryCache();

            // ── Background jobs ────────────────────────────────────────────
            // Replace HangfireBackgroundJobQueue with a recording fake so handler
            // calls are captured for test assertions (and Hangfire enqueueing —
            // which would touch Postgres and trigger SMTP retry storms — never runs).
            services.RemoveAll<IBackgroundJobQueue>();
            services.AddSingleton<IBackgroundJobQueue>(Queue);

            // ── Event bus ──────────────────────────────────────────────────
            // RabbitMq:Enabled=false above caused AddMessaging to register the
            // NullEventPublisher; swap it for the recording fake so payment
            // handler tests can assert on published events.
            services.RemoveAll<IEventPublisher>();
            services.AddSingleton<IEventPublisher>(Events);
        });
    }
}
