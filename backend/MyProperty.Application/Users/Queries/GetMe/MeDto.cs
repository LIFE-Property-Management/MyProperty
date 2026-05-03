using MyProperty.Domain.Enums;

namespace MyProperty.Application.Users.Queries.GetMe;

/// <summary>
/// Response shape for <c>GET /api/v1/me</c>. Reflects the current user's
/// domain entity plus their realm roles from the JWT.
/// </summary>
public sealed record MeDto(
    Guid Id,
    string KeycloakSubId,
    string Email,
    string FirstName,
    string LastName,
    string? Phone,
    TenantAccountStatus? AccountStatus,
    IReadOnlyCollection<string> Roles
);
