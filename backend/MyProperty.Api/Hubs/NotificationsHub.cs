using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using MyProperty.Application.Common.Interfaces;

namespace MyProperty.Api.Hubs;

/// <summary>
/// Single SignalR hub for server-push notifications. Connections are placed
/// into role-scoped groups based on the authenticated principal so consumers
/// can target by domain identity (<c>tenant:{userId}</c> or
/// <c>landlord:{userId}</c>) rather than connection IDs.
/// </summary>
/// <remarks>
/// <para>
/// <b>Server-push only.</b> The hub deliberately exposes no client-callable
/// methods for business operations. State changes still go through the REST
/// API; the hub is only a delivery channel for change notifications. This
/// keeps authorization and validation centralised in the controller stack.
/// </para>
/// <para>
/// <b>Group keys use the internal <see cref="MyProperty.Domain.Entities.User"/>
/// id, not the Keycloak <c>sub</c> claim.</b> RabbitMQ event payloads carry
/// the internal id (see <c>Application/Payments/Events/</c>), so consumers can
/// route directly without a second lookup. The hub takes the cost of the
/// Keycloak-sub → internal-id resolution once per connection.
/// </para>
/// <para>
/// <b>Auth.</b> JWT bearer is required (<see cref="AuthorizeAttribute"/>);
/// the WebSocket handshake reads the token from the <c>?access_token=</c>
/// query string — wired in <c>Program.cs</c> via
/// <c>JwtBearerEvents.OnMessageReceived</c>.
/// </para>
/// </remarks>
[Authorize]
public sealed class NotificationsHub(
    IUserRepository users,
    ILogger<NotificationsHub> logger) : Hub
{
    public const string Path = "/hubs/notifications";

    public static string TenantGroup(Guid userId) => $"tenant:{userId}";
    public static string LandlordGroup(Guid userId) => $"landlord:{userId}";

    public override async Task OnConnectedAsync()
    {
        var principal = Context.User
            ?? throw new HubException("Authenticated principal missing on connect.");

        var sub = principal.FindFirst("sub")?.Value;
        if (string.IsNullOrEmpty(sub))
        {
            // Should never happen given [Authorize] + ValidateAudience, but a
            // missing sub means we can't pin the connection to a domain user.
            logger.LogWarning(
                "Hub connection {ConnectionId} has no sub claim; closing.",
                Context.ConnectionId);
            Context.Abort();
            return;
        }

        var user = await users.GetByKeycloakSubIdAsync(sub, Context.ConnectionAborted);
        if (user is null)
        {
            // The user has authenticated against Keycloak but never synced into
            // our user table (no REST call has run GetOrSyncAsync).
            // Without an internal id we can't assign a domain group; abort the
            // connection so the client retries after a REST round-trip.
            logger.LogInformation(
                "Hub connection {ConnectionId} for unknown sub {Sub} — closing; client should hit REST first.",
                Context.ConnectionId, sub);
            Context.Abort();
            return;
        }

        // Roles flow from KeycloakRolesTransformer (realm_access.roles → Role
        // claims). A single user could in principle hold multiple roles; we
        // add to every applicable group rather than picking one, so a future
        // landlord-who-also-tenants doesn't lose either feed.
        var groupsAdded = 0;
        if (principal.IsInRole("Tenant"))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, TenantGroup(user.Id), Context.ConnectionAborted);
            groupsAdded++;
        }
        if (principal.IsInRole("Landlord"))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, LandlordGroup(user.Id), Context.ConnectionAborted);
            groupsAdded++;
        }

        if (groupsAdded == 0)
        {
            logger.LogInformation(
                "Hub connection {ConnectionId} for user {UserId} has no Tenant/Landlord role; nothing to subscribe to.",
                Context.ConnectionId, user.Id);
            Context.Abort();
            return;
        }

        logger.LogInformation(
            "Hub connection {ConnectionId} bound to user {UserId} ({GroupCount} group(s)).",
            Context.ConnectionId, user.Id, groupsAdded);

        await base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        // SignalR removes the connection from every group automatically on
        // disconnect, so there's no manual cleanup. Log for traceability —
        // exception is non-null on abnormal closes (network drops, server
        // shutdown), null on a clean client-initiated close.
        if (exception is not null)
        {
            logger.LogInformation(
                exception,
                "Hub connection {ConnectionId} closed with error.",
                Context.ConnectionId);
        }
        return base.OnDisconnectedAsync(exception);
    }
}
