using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace MyProperty.Tests.Integration.Fixtures;

/// <summary>
/// Thin Keycloak Admin REST client used by the integration-test fixture to
/// provision a self-contained realm: roles, a public client with the password
/// grant enabled, and per-test users with role assignments. Also exposes a
/// password-grant helper so tests can mint real Keycloak access tokens for the
/// API to validate.
/// </summary>
internal sealed class KeycloakAdmin(string baseAddress, string adminUser, string adminPassword)
    : IDisposable
{
    private readonly HttpClient _http = new() { BaseAddress = new Uri(baseAddress.TrimEnd('/') + "/") };
    private readonly string _adminUser = adminUser;
    private readonly string _adminPassword = adminPassword;
    private string? _adminToken;

    public string BaseAddress => _http.BaseAddress!.ToString().TrimEnd('/');

    public async Task EnsureRealmAsync(string realm)
    {
        await EnsureAdminTokenAsync();

        // GET /admin/realms/{realm} — 404 if missing.
        var probe = await _http.GetAsync($"admin/realms/{realm}");
        if (probe.StatusCode == HttpStatusCode.OK) return;

        var create = await _http.PostAsJsonAsync("admin/realms", new
        {
            realm,
            enabled = true,
            sslRequired = "none",
            accessTokenLifespan = 600,
        });
        EnsureSuccess(create, $"create realm '{realm}'");
    }

    public async Task EnsureRealmRoleAsync(string realm, string role)
    {
        await EnsureAdminTokenAsync();

        var probe = await _http.GetAsync($"admin/realms/{realm}/roles/{role}");
        if (probe.StatusCode == HttpStatusCode.OK) return;

        var create = await _http.PostAsJsonAsync($"admin/realms/{realm}/roles", new { name = role });
        EnsureSuccess(create, $"create role '{role}'");
    }

    /// <summary>
    /// Creates a public client with direct access grants enabled so tests can
    /// fetch tokens via the OAuth2 password grant. fullScopeAllowed=true so the
    /// `realm_access.roles` claim contains every realm role assigned to the user.
    /// </summary>
    public async Task EnsurePublicClientAsync(string realm, string clientId)
    {
        await EnsureAdminTokenAsync();

        var probe = await _http.GetAsync($"admin/realms/{realm}/clients?clientId={clientId}");
        EnsureSuccess(probe, $"list clients for '{clientId}'");

        var existing = await probe.Content.ReadFromJsonAsync<JsonElement>();
        if (existing.GetArrayLength() > 0) return;

        var create = await _http.PostAsJsonAsync($"admin/realms/{realm}/clients", new
        {
            clientId,
            enabled = true,
            publicClient = true,
            directAccessGrantsEnabled = true,
            standardFlowEnabled = false,
            implicitFlowEnabled = false,
            serviceAccountsEnabled = false,
            fullScopeAllowed = true,
            redirectUris = Array.Empty<string>(),
            webOrigins = Array.Empty<string>(),
        });
        EnsureSuccess(create, $"create client '{clientId}'");
    }

    public async Task<string> CreateUserAsync(
        string realm, string email, string password, params string[] roles)
    {
        await EnsureAdminTokenAsync();

        var create = await _http.PostAsJsonAsync($"admin/realms/{realm}/users", new
        {
            username = email,
            email,
            emailVerified = true,
            firstName = email.Split('@')[0],
            lastName = "User",
            enabled = true,
            credentials = new[]
            {
                new { type = "password", value = password, temporary = false },
            },
        });

        // 201 Created on success; 409 Conflict if user already exists (re-use test fixture).
        if (create.StatusCode != HttpStatusCode.Created && create.StatusCode != HttpStatusCode.Conflict)
        {
            EnsureSuccess(create, $"create user '{email}'");
        }

        var lookup = await _http.GetAsync($"admin/realms/{realm}/users?username={Uri.EscapeDataString(email)}&exact=true");
        EnsureSuccess(lookup, $"lookup user '{email}'");
        var users = await lookup.Content.ReadFromJsonAsync<JsonElement>();
        var userId = users[0].GetProperty("id").GetString()!;

        if (roles.Length > 0)
        {
            // Assign each realm role to the user. The endpoint takes role
            // representations (id+name), not just names — fetch them first.
            var rolePayload = new List<object>();
            foreach (var roleName in roles)
            {
                var roleResp = await _http.GetAsync($"admin/realms/{realm}/roles/{roleName}");
                EnsureSuccess(roleResp, $"lookup role '{roleName}'");
                var role = await roleResp.Content.ReadFromJsonAsync<JsonElement>();
                rolePayload.Add(new
                {
                    id = role.GetProperty("id").GetString(),
                    name = role.GetProperty("name").GetString(),
                });
            }

            var assign = await _http.PostAsJsonAsync(
                $"admin/realms/{realm}/users/{userId}/role-mappings/realm",
                rolePayload);
            EnsureSuccess(assign, $"assign roles to '{email}'");
        }

        return userId;
    }

    /// <summary>
    /// OAuth2 password grant against the user's realm — returns the access token
    /// that the API will validate via Keycloak's JWKS endpoint.
    /// </summary>
    public async Task<string> GetAccessTokenAsync(
        string realm, string clientId, string username, string password)
    {
        // Password grant uses the realm's public token endpoint (no admin auth).
        using var client = new HttpClient { BaseAddress = _http.BaseAddress };
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "password",
            ["client_id"] = clientId,
            ["username"] = username,
            ["password"] = password,
        });

        var resp = await client.PostAsync($"realms/{realm}/protocol/openid-connect/token", form);
        EnsureSuccess(resp, $"password-grant token for '{username}'");

        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return json.GetProperty("access_token").GetString()!;
    }

    private async Task EnsureAdminTokenAsync()
    {
        if (_adminToken is not null) return;

        // The master realm always exposes the admin-cli client for the bootstrap admin.
        using var bootstrap = new HttpClient { BaseAddress = _http.BaseAddress };
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "password",
            ["client_id"] = "admin-cli",
            ["username"] = _adminUser,
            ["password"] = _adminPassword,
        });

        var resp = await bootstrap.PostAsync("realms/master/protocol/openid-connect/token", form);
        EnsureSuccess(resp, "obtain Keycloak admin token");

        var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
        _adminToken = json.GetProperty("access_token").GetString();
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _adminToken);
    }

    private static void EnsureSuccess(HttpResponseMessage resp, string action)
    {
        if (resp.IsSuccessStatusCode) return;
        var body = resp.Content.ReadAsStringAsync().GetAwaiter().GetResult();
        throw new InvalidOperationException(
            $"Keycloak admin call failed: {action} → {(int)resp.StatusCode} {resp.ReasonPhrase}: {body}");
    }

    public void Dispose() => _http.Dispose();
}
