using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Leases.Queries.GetTenantLease;
using MyProperty.Application.Users.Queries.GetMe;
using Swashbuckle.AspNetCore.Annotations;

namespace MyProperty.Api.Controllers.V1;

/// <summary>
/// Returns information about the currently authenticated user.
/// Drives lazy upsert of the User row on each call — the first time a
/// Keycloak user hits any authenticated endpoint that goes through this
/// controller, their domain row is created.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/me")]
[Authorize]
[EnableRateLimiting("authenticated")]
public sealed class MeController(
    IUserRepository userRepository,
    GetTenantLeaseHandler getTenantLease,
    ICurrentUser currentUser) : ControllerBase
{
    /// <summary>
    /// Returns the current user's identity, domain fields, and realm roles.
    /// Creates the User row on first authenticated request.
    /// </summary>
    [HttpGet]
    [SwaggerOperation(
        Summary = "Current user",
        Description = "Returns the authenticated user's domain entity and realm roles. " +
                      "Lazily upserts the User row from JWT claims.")]
    [ProducesResponseType(typeof(MeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<MeDto>> Get(CancellationToken ct)
    {
        var user = await userRepository.GetOrSyncFromClaimsAsync(User, ct);

        return Ok(new MeDto(
            Id: user.Id,
            KeycloakSubId: user.KeycloakSubId,
            Email: user.Email,
            FirstName: user.FirstName,
            LastName: user.LastName,
            Phone: user.Phone,
            AccountStatus: user.AccountStatus,
            Roles: currentUser.Roles));
    }

    /// <summary>
    /// Tenant-only echo endpoint. Verifies <c>RequireTenant</c> policy
    /// fires correctly. Returns 403 for non-tenants.
    /// </summary>
    [HttpGet("tenant-only")]
    [Authorize(Policy = "RequireTenant")]
    [SwaggerOperation(
        Summary = "Tenant-only echo",
        Description = "Returns identity if caller has the Tenant role; 403 otherwise.")]
    [ProducesResponseType(typeof(MeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<MeDto>> GetTenantOnly(CancellationToken ct)
    {
        var user = await userRepository.GetOrSyncFromClaimsAsync(User, ct);

        return Ok(new MeDto(
            Id: user.Id,
            KeycloakSubId: user.KeycloakSubId,
            Email: user.Email,
            FirstName: user.FirstName,
            LastName: user.LastName,
            Phone: user.Phone,
            AccountStatus: user.AccountStatus,
            Roles: currentUser.Roles));
    }

    /// <summary>
    /// Returns the active lease for the authenticated tenant.
    /// Returns 204 if the tenant has no active lease.
    /// </summary>
    [HttpGet("lease")]
    [Authorize(Policy = "RequireTenant")]
    [SwaggerOperation(
        Summary = "Active lease for current tenant",
        Description = "Returns the tenant's active lease summary, or 204 if none exists.")]
    [ProducesResponseType(typeof(TenantLeaseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<TenantLeaseDto>> Lease(CancellationToken ct)
    {
        var user = await userRepository.GetOrSyncFromClaimsAsync(User, ct);
        var result = await getTenantLease.Handle(new GetTenantLeaseQuery(user.Id), ct);
        if (result is null)
            return NoContent();
        return Ok(result);
    }
}
