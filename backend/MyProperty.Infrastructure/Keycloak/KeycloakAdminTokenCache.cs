using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace MyProperty.Infrastructure.Keycloak;

/// <summary>
/// Caches the client-credentials access token in memory, refreshing it ~30 s
/// before expiry. Thread-safe via a lock so concurrent first-time callers
/// don't fire multiple token requests.
/// </summary>
internal sealed class KeycloakAdminTokenCache(
    IHttpClientFactory httpClientFactory,
    IOptions<KeycloakAdminOptions> options,
    ILogger<KeycloakAdminTokenCache> logger) : IKeycloakAdminTokenCache
{
    private readonly KeycloakAdminOptions _opts = options.Value;
    private string? _token;
    private DateTime _expiresAt = DateTime.MinValue;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public async Task<string> GetTokenAsync(CancellationToken ct)
    {
        if (_token is not null && DateTime.UtcNow < _expiresAt)
            return _token;

        await _lock.WaitAsync(ct);
        try
        {
            // Double-check inside the lock in case another thread already refreshed.
            if (_token is not null && DateTime.UtcNow < _expiresAt)
                return _token;

            (_token, _expiresAt) = await FetchTokenAsync(ct);
            return _token;
        }
        finally
        {
            _lock.Release();
        }
    }

    private async Task<(string token, DateTime expiresAt)> FetchTokenAsync(CancellationToken ct)
    {
        using var http = httpClientFactory.CreateClient();
        using var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "client_credentials",
            ["client_id"] = _opts.ClientId,
            ["client_secret"] = _opts.ClientSecret,
        });

        var resp = await http.PostAsync(
            $"{_opts.BaseUrl}/realms/{_opts.Realm}/protocol/openid-connect/token",
            form, ct);

        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync(ct);
            logger.LogError(
                "Keycloak client_credentials token request failed: {Status} {Body}",
                (int)resp.StatusCode, body);
            resp.EnsureSuccessStatusCode();
        }

        var json = await resp.Content.ReadFromJsonAsync<JsonElement>(ct);
        var accessToken = json.GetProperty("access_token").GetString()!;
        var expiresIn = json.GetProperty("expires_in").GetInt32();
        var expiresAt = DateTime.UtcNow.AddSeconds(expiresIn - 30);

        return (accessToken, expiresAt);
    }
}
