using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyProperty.Application.Common.Interfaces;

namespace MyProperty.Infrastructure.Keycloak;

/// <summary>
/// Provisions Keycloak users via the Admin REST API using the myproperty-api
/// client-credentials service account. Three-call sequence per KC 26:
///   1. POST /users           → 201 with Location header containing the new user ID
///   2. PUT  /users/{id}/reset-password → 204
///   3. GET  /roles/{name} + POST /users/{id}/role-mappings/realm → 204
/// </summary>
internal sealed class KeycloakAdminClient(
    HttpClient http,
    IKeycloakAdminTokenCache tokenCache,
    IOptions<KeycloakAdminOptions> options,
    ILogger<KeycloakAdminClient> logger) : IUserAccountProvisioner
{
    private readonly KeycloakAdminOptions _opts = options.Value;

    public async Task<string> CreateAsync(ProvisionUserRequest request, CancellationToken ct)
    {
        await SetAuthHeaderAsync(ct);

        // ── Step 1: create user ──────────────────────────────────────────────────
        var createBody = new
        {
            username = request.Email,
            email = request.Email,
            firstName = request.FirstName,
            lastName = request.LastName,
            enabled = true,
            emailVerified = false,
            attributes = request.Phone is not null
                ? new Dictionary<string, string[]> { ["phone"] = [request.Phone] }
                : null,
        };

        var createResp = await http.PostAsJsonAsync(AdminUrl("/users"), createBody, ct);

        if (createResp.StatusCode == HttpStatusCode.Conflict)
            throw new UserAlreadyExistsException(request.Email);

        if (!createResp.IsSuccessStatusCode)
        {
            var body = await createResp.Content.ReadAsStringAsync(ct);
            logger.LogError(
                "Keycloak create-user failed for {Email}: {Status} {Body}",
                request.Email, (int)createResp.StatusCode, body);
            createResp.EnsureSuccessStatusCode();
        }

        var sub = ExtractIdFromLocation(createResp);

        // ── Step 2: set password ─────────────────────────────────────────────────
        var pwBody = new { type = "password", value = request.Password, temporary = false };
        var pwResp = await http.PutAsJsonAsync(AdminUrl($"/users/{sub}/reset-password"), pwBody, ct);
        if (!pwResp.IsSuccessStatusCode)
        {
            var body = await pwResp.Content.ReadAsStringAsync(ct);
            logger.LogError(
                "Keycloak reset-password failed for user {Sub} ({Email}): {Status} {Body}",
                sub, request.Email, (int)pwResp.StatusCode, body);
            // User exists without a password — log but don't swallow
            pwResp.EnsureSuccessStatusCode();
        }

        // ── Step 3: assign realm role ────────────────────────────────────────────
        var roleResp = await http.GetAsync(AdminUrl($"/roles/{request.RealmRole}"), ct);
        if (!roleResp.IsSuccessStatusCode)
        {
            var body = await roleResp.Content.ReadAsStringAsync(ct);
            logger.LogError(
                "Keycloak lookup role {Role} failed: {Status} {Body}",
                request.RealmRole, (int)roleResp.StatusCode, body);
            roleResp.EnsureSuccessStatusCode();
        }

        var roleJson = await roleResp.Content.ReadFromJsonAsync<JsonElement>(ct);
        var rolePayload = new[]
        {
            new
            {
                id = roleJson.GetProperty("id").GetString(),
                name = roleJson.GetProperty("name").GetString(),
            },
        };

        var assignResp = await http.PostAsJsonAsync(
            AdminUrl($"/users/{sub}/role-mappings/realm"), rolePayload, ct);

        if (!assignResp.IsSuccessStatusCode)
        {
            var body = await assignResp.Content.ReadAsStringAsync(ct);
            logger.LogError(
                "Keycloak role-assign {Role} failed for user {Sub} ({Email}): {Status} {Body}",
                request.RealmRole, sub, request.Email, (int)assignResp.StatusCode, body);
            assignResp.EnsureSuccessStatusCode();
        }

        return sub;
    }

    private async Task SetAuthHeaderAsync(CancellationToken ct)
    {
        var token = await tokenCache.GetTokenAsync(ct);
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    private string AdminUrl(string path) =>
        $"{_opts.BaseUrl}/admin/realms/{_opts.Realm}{path}";

    private static string ExtractIdFromLocation(HttpResponseMessage resp)
    {
        // Keycloak responds with Location: .../admin/realms/{realm}/users/{uuid}
        var location = resp.Headers.Location?.ToString()
            ?? throw new InvalidOperationException("Keycloak POST /users returned 201 but no Location header.");
        return location.Split('/').Last();
    }
}
