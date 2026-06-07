using System.Net.Http.Headers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.DependencyInjection;
using MyProperty.Infrastructure.Caching;
using MyProperty.Infrastructure.Persistence;
using Testcontainers.Keycloak;
using Testcontainers.PostgreSql;

namespace MyProperty.Tests.Integration.Fixtures;

/// <summary>
/// Shared collection fixture for every integration test class. Spins up a real
/// Postgres + Keycloak (via Testcontainers) once per test run, provisions a
/// hermetic realm with three realm roles and four seed users (landlord×2,
/// tenant×2), applies EF Core migrations, and exposes a configured
/// <see cref="WebApplicationFactory{Program}"/> + helpers for fetching real
/// access tokens via the OAuth2 password grant.
/// </summary>
public sealed class ApiFixture : IAsyncLifetime
{
    private const string RealmName = "MyPropertyTest";
    private const string ClientId = "test-cli";
    private const string ApiClientId = "test-api";
    private const string ApiClientSecret = "test-api-secret";

    public const string LandlordEmail = "landlord@test.local";
    public const string Landlord2Email = "landlord2@test.local";
    public const string TenantEmail = "tenant@test.local";
    public const string ImposterEmail = "imposter@test.local";
    public const string AdminEmail = "admin@test.local";
    public const string SeedPassword = "Password1!";

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithDatabase("myproperty")
        .WithUsername("postgres")
        .WithPassword("postgres")
        .Build();

    private readonly KeycloakContainer _keycloak = new KeycloakBuilder()
        .WithImage("quay.io/keycloak/keycloak:26.2")
        .Build();

    private KeycloakAdmin _admin = null!;

    internal MyPropertyApiFactory Factory { get; private set; } = null!;
    internal RecordingBackgroundJobQueue Queue => Factory.Queue;
    internal RecordingEventPublisher Events => Factory.Events;

    public async Task InitializeAsync()
    {
        await Task.WhenAll(_postgres.StartAsync(), _keycloak.StartAsync());

        // Provision a hermetic realm — kept separate from the production
        // realm-export.json so test infra has zero coupling to dev infra.
        _admin = new KeycloakAdmin(_keycloak.GetBaseAddress(), adminUser: "admin", adminPassword: "admin");
        await _admin.EnsureRealmAsync(RealmName);
        await _admin.EnsureRealmRoleAsync(RealmName, "Tenant");
        await _admin.EnsureRealmRoleAsync(RealmName, "Landlord");
        await _admin.EnsureRealmRoleAsync(RealmName, "Admin");
        await _admin.EnsurePublicClientAsync(RealmName, ClientId);
        await _admin.EnsureServiceAccountClientAsync(RealmName, ApiClientId, ApiClientSecret);

        await _admin.CreateUserAsync(RealmName, LandlordEmail, SeedPassword, "Landlord");
        await _admin.CreateUserAsync(RealmName, Landlord2Email, SeedPassword, "Landlord");
        await _admin.CreateUserAsync(RealmName, TenantEmail, SeedPassword, "Tenant");
        await _admin.CreateUserAsync(RealmName, ImposterEmail, SeedPassword, "Tenant");
        // Admin portal user — holds ONLY the Admin realm role (matches the
        // single-portal-role rule the frontend's decodePayload enforces).
        await _admin.CreateUserAsync(RealmName, AdminEmail, SeedPassword, "Admin");

        var keycloakBaseUrl = _keycloak.GetBaseAddress().TrimEnd('/');

        Factory = new MyPropertyApiFactory(
            postgresConnectionString: _postgres.GetConnectionString(),
            keycloakAuthority: $"{keycloakBaseUrl}/realms/{RealmName}",
            keycloakBaseUrl: keycloakBaseUrl,
            keycloakAdminRealm: RealmName,
            keycloakAdminClientId: ApiClientId,
            keycloakAdminClientSecret: ApiClientSecret);

        // Force factory bootstrap by resolving the service provider, then run
        // EF Core migrations against the real Postgres container.
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
    }

    public async Task DisposeAsync()
    {
        Factory.Dispose();
        _admin.Dispose();
        await _keycloak.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    /// <summary>
    /// Mints a real Keycloak access token for the given seed user. The API
    /// validates the token via Keycloak's JWKS endpoint just like in production —
    /// no signing keys are stubbed, no auth handler is replaced.
    /// </summary>
    public Task<string> GetTokenAsync(string email, string password = SeedPassword)
        => _admin.GetAccessTokenAsync(RealmName, ClientId, email, password);

    /// <summary>
    /// Mints a token for a user that was provisioned during the test (not a seed user).
    /// Uses the same password-grant client as <see cref="GetTokenAsync"/>.
    /// </summary>
    public Task<string> GetTokenForNewUserAsync(string email, string password)
        => _admin.GetAccessTokenAsync(RealmName, ClientId, email, password);

    public HttpClient CreateClient() => Factory.CreateClient();

    public async Task<HttpClient> CreateAuthenticatedClientAsync(string email, string password = SeedPassword)
    {
        var token = await GetTokenAsync(email, password);
        var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    /// <summary>
    /// Opens a fresh DbContext scope so tests can seed entities or assert state
    /// directly. Bypasses any cached state in handler scopes.
    /// </summary>
    public async Task WithDbAsync(Func<AppDbContext, Task> action)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await action(db);
    }

    public async Task<T> WithDbAsync<T>(Func<AppDbContext, Task<T>> action)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await action(db);
    }

    /// <summary>
    /// Removes a single landlord-dashboard cache entry. Used by tests that
    /// need to assert cache-miss vs cache-hit behavior without depending on
    /// TTL expiry.
    /// </summary>
    public async Task EvictDashboardCacheAsync(Guid landlordId)
    {
        using var scope = Factory.Services.CreateScope();
        var cache = scope.ServiceProvider.GetRequiredService<IDistributedCache>();
        await cache.RemoveAsync(CacheKeys.LandlordDashboard(landlordId));
    }

    /// <summary>
    /// Removes the single global stakeholder-dashboard cache entry, so the next
    /// request is guaranteed a cache miss regardless of what earlier tests in
    /// this collection left warm.
    /// </summary>
    public async Task EvictStakeholderDashboardCacheAsync()
    {
        using var scope = Factory.Services.CreateScope();
        var cache = scope.ServiceProvider.GetRequiredService<IDistributedCache>();
        await cache.RemoveAsync(CacheKeys.StakeholderDashboard());
    }
}
