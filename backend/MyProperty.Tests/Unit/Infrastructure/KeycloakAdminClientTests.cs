using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Infrastructure.Keycloak;

namespace MyProperty.Tests.Unit.Infrastructure;

public sealed class KeycloakAdminClientTests
{
    private readonly Mock<IKeycloakAdminTokenCache> _tokenCache = new(MockBehavior.Strict);

    public KeycloakAdminClientTests() =>
        _tokenCache.Setup(c => c.GetTokenAsync(It.IsAny<CancellationToken>()))
                   .ReturnsAsync("fake-admin-token");

    private static ProvisionUserRequest ValidRequest(string role = "Landlord") =>
        new("ada@example.com", "Ada", "Lovelace", "+38349123456", "Password1", role);

    private KeycloakAdminClient BuildSut(RecordingHandler handler)
    {
        var opts = Options.Create(new KeycloakAdminOptions
        {
            BaseUrl = RecordingHandler.BaseUrl,
            Realm = "MyProperty",
            ClientId = "myproperty-api",
            ClientSecret = "test-secret",
        });

        var http = new HttpClient(handler, disposeHandler: false);
        return new KeycloakAdminClient(
            http, _tokenCache.Object, opts, NullLogger<KeycloakAdminClient>.Instance);
    }

    [Fact]
    public async Task Create_fires_three_admin_calls_in_order_and_returns_sub_from_location()
    {
        var handler = new RecordingHandler();
        var sut = BuildSut(handler);

        var sub = await sut.CreateAsync(ValidRequest(), CancellationToken.None);

        Assert.Equal(RecordingHandler.CreatedUserId, sub);

        // A cached token is fetched and applied as the bearer credential.
        _tokenCache.Verify(c => c.GetTokenAsync(It.IsAny<CancellationToken>()), Times.Once);
        Assert.All(handler.Requests, r =>
            Assert.Equal("fake-admin-token", r.BearerToken));

        Assert.Equal(4, handler.Requests.Count);

        // 1. POST /users
        Assert.Equal(HttpMethod.Post, handler.Requests[0].Method);
        Assert.EndsWith("/admin/realms/MyProperty/users", handler.Requests[0].Path);
        // 2. PUT /users/{id}/reset-password
        Assert.Equal(HttpMethod.Put, handler.Requests[1].Method);
        Assert.EndsWith($"/users/{RecordingHandler.CreatedUserId}/reset-password", handler.Requests[1].Path);
        // 3. GET /roles/{name}
        Assert.Equal(HttpMethod.Get, handler.Requests[2].Method);
        Assert.EndsWith("/roles/Landlord", handler.Requests[2].Path);
        // 4. POST /users/{id}/role-mappings/realm
        Assert.Equal(HttpMethod.Post, handler.Requests[3].Method);
        Assert.EndsWith($"/users/{RecordingHandler.CreatedUserId}/role-mappings/realm", handler.Requests[3].Path);

        // create body
        using var create = JsonDocument.Parse(handler.Requests[0].Body!);
        Assert.Equal("ada@example.com", create.RootElement.GetProperty("username").GetString());
        Assert.Equal("ada@example.com", create.RootElement.GetProperty("email").GetString());
        Assert.Equal("Ada", create.RootElement.GetProperty("firstName").GetString());
        Assert.Equal("Lovelace", create.RootElement.GetProperty("lastName").GetString());
        Assert.True(create.RootElement.GetProperty("enabled").GetBoolean());
        Assert.False(create.RootElement.GetProperty("emailVerified").GetBoolean());
        Assert.Equal("+38349123456",
            create.RootElement.GetProperty("attributes").GetProperty("phone")[0].GetString());

        // reset-password body
        using var pw = JsonDocument.Parse(handler.Requests[1].Body!);
        Assert.Equal("password", pw.RootElement.GetProperty("type").GetString());
        Assert.Equal("Password1", pw.RootElement.GetProperty("value").GetString());
        Assert.False(pw.RootElement.GetProperty("temporary").GetBoolean());

        // role-mapping body: [{ id, name }]
        using var roles = JsonDocument.Parse(handler.Requests[3].Body!);
        Assert.Equal(1, roles.RootElement.GetArrayLength());
        Assert.Equal("Landlord", roles.RootElement[0].GetProperty("name").GetString());
        Assert.Equal(RecordingHandler.RoleId, roles.RootElement[0].GetProperty("id").GetString());
    }

    [Fact]
    public async Task Create_translates_409_on_user_create_to_UserAlreadyExistsException()
    {
        var handler = new RecordingHandler { ConflictOnCreate = true };
        var sut = BuildSut(handler);

        var ex = await Assert.ThrowsAsync<UserAlreadyExistsException>(
            () => sut.CreateAsync(ValidRequest(), CancellationToken.None));
        Assert.Contains("ada@example.com", ex.Message);

        // Only the create attempt fired — no password/role calls after the conflict.
        Assert.Single(handler.Requests);
        Assert.EndsWith("/users", handler.Requests[0].Path);
    }

    private sealed record RecordedRequest(HttpMethod Method, string Path, string? Body, string? BearerToken);

    private sealed class RecordingHandler : HttpMessageHandler
    {
        public const string BaseUrl = "http://keycloak.test:8080";
        public const string CreatedUserId = "11111111-2222-3333-4444-555555555555";
        public const string RoleId = "role-id-abc123";

        public bool ConflictOnCreate { get; init; }
        public List<RecordedRequest> Requests { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var path = request.RequestUri!.AbsolutePath;
            var body = request.Content is null
                ? null
                : await request.Content.ReadAsStringAsync(cancellationToken);
            Requests.Add(new RecordedRequest(
                request.Method, path, body, request.Headers.Authorization?.Parameter));

            // 1. create user
            if (request.Method == HttpMethod.Post && path.EndsWith("/users"))
            {
                if (ConflictOnCreate)
                    return new HttpResponseMessage(HttpStatusCode.Conflict);
                var resp = new HttpResponseMessage(HttpStatusCode.Created);
                resp.Headers.Location =
                    new Uri($"{BaseUrl}/admin/realms/MyProperty/users/{CreatedUserId}");
                return resp;
            }

            // 2. reset password
            if (request.Method == HttpMethod.Put && path.EndsWith("/reset-password"))
                return new HttpResponseMessage(HttpStatusCode.NoContent);

            // 3a. role lookup
            if (request.Method == HttpMethod.Get && path.Contains("/roles/"))
            {
                var roleName = path.Split('/').Last();
                return Json(HttpStatusCode.OK, $$"""{"id":"{{RoleId}}","name":"{{roleName}}"}""");
            }

            // 3b. assign realm role
            if (request.Method == HttpMethod.Post && path.EndsWith("/role-mappings/realm"))
                return new HttpResponseMessage(HttpStatusCode.NoContent);

            return new HttpResponseMessage(HttpStatusCode.NotFound);
        }

        private static HttpResponseMessage Json(HttpStatusCode code, string json) =>
            new(code) { Content = new StringContent(json, Encoding.UTF8, "application/json") };
    }
}
