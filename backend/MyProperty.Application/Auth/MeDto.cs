namespace MyProperty.Application.Auth;

/// <summary>
/// Identity information for the currently authenticated principal.
/// Returned by <c>GET /api/v1/me</c>.
/// </summary>
/// <param name="UserId">Keycloak subject ID (JWT <c>sub</c> claim).</param>
/// <param name="UserName">Preferred username (typically email).</param>
/// <param name="Roles">Realm roles assigned to the user.</param>
public sealed record MeDto(
    string UserId,
    string UserName,
    IReadOnlyCollection<string> Roles);
