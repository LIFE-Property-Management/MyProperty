using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MyProperty.Application.Common.FeatureFlags;
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
    string keycloakAuthority,
    string keycloakBaseUrl,
    string keycloakAdminRealm,
    string keycloakAdminClientId,
    string keycloakAdminClientSecret) : WebApplicationFactory<Program>
{
    public RecordingBackgroundJobQueue Queue { get; } = new();
    public RecordingEventPublisher Events { get; } = new();
    public StubFeatureFlags Flags { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // "Development" so RequireHttpsMetadata=false on the JWT bearer scheme —
        // Testcontainers' Keycloak only exposes HTTP, and the production gate in
        // Program.cs deliberately permits HTTP metadata only in Development.
        builder.UseEnvironment("Development");

        builder.UseSetting("ConnectionStrings:Postgres", postgresConnectionString);
        builder.UseSetting("Keycloak:Authority", keycloakAuthority);
        builder.UseSetting("KeycloakAdmin:BaseUrl", keycloakBaseUrl);
        builder.UseSetting("KeycloakAdmin:Realm", keycloakAdminRealm);
        builder.UseSetting("KeycloakAdmin:ClientId", keycloakAdminClientId);
        builder.UseSetting("KeycloakAdmin:ClientSecret", keycloakAdminClientSecret);

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

        // Skip the StackExchange.Redis SignalR backplane — Cache:RedisConnection
        // points at a non-existent host in tests, and connection attempts would
        // throw on host startup. SignalR itself is still registered so the hub
        // and IHubContext are resolvable; deliveries just fan out via the
        // in-process backplane.
        builder.UseSetting("SignalR:UseRedisBackplane", "false");

        // Unleash options must satisfy ValidateDataAnnotations() at startup, but no
        // live server is contacted: an empty ApiToken makes AddFeatureFlags register
        // NullFeatureFlags, which we replace with the recording stub below.
        builder.UseSetting("Unleash:ApiUrl", "http://unused:4242/api/");
        builder.UseSetting("Unleash:ApiToken", "");

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

            // ── Feature flags ──────────────────────────────────────────────
            // AddFeatureFlags registered NullFeatureFlags (empty token above);
            // swap in the stub so tests can force flag values via Factory.Flags.
            services.RemoveAll<IFeatureFlags>();
            services.AddSingleton<IFeatureFlags>(Flags);
        });
    }
}
