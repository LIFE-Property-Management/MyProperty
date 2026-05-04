using System.Security.Claims;
using MyProperty.Application.Common.Interfaces;

namespace MyProperty.Api.Auth;

/// <summary>
/// <see cref="ICurrentUser"/> implementation that reads the authenticated
/// principal from the current HTTP request via <see cref="IHttpContextAccessor"/>.
/// Registered as scoped — one instance per request.
/// </summary>
/// <remarks>
/// Reads the user ID from the JWT <c>sub</c> claim directly because the legacy
/// inbound claim type map is cleared in <c>Program.cs</c>.
/// </remarks>
public sealed class HttpContextCurrentUser(IHttpContextAccessor httpContextAccessor) : ICurrentUser
{
    public ClaimsPrincipal? Principal => httpContextAccessor.HttpContext?.User;

    public string? KeycloakSubId => Principal?.FindFirst("sub")?.Value;

    public string? UserName => Principal?.Identity?.Name;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated ?? false;

    public IReadOnlyCollection<string> Roles =>
        Principal?.FindAll(ClaimTypes.Role)
            .Select(c => c.Value)
            .ToArray()
        ?? [];

    public bool IsInRole(string role) => Principal?.IsInRole(role) ?? false;
}
