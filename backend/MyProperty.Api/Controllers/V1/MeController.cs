using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyProperty.Application.Auth;
using MyProperty.Application.Common.Interfaces;
using Swashbuckle.AspNetCore.Annotations;

namespace MyProperty.Api.Controllers.V1;

/// <summary>
/// Returns information about the currently authenticated user.
/// Used by the frontend to populate role-aware UI and by integration tests
/// to verify the auth stack end-to-end.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/me")]
public sealed class MeController(ICurrentUser currentUser) : ControllerBase
{
    /// <summary>
    /// Returns the current user's identity. Requires any authenticated user.
    /// </summary>
    [HttpGet]
    [SwaggerOperation(Summary = "Current user", Description = "Returns the authenticated user's identity and realm roles.")]
    [ProducesResponseType(typeof(MeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public ActionResult<MeDto> Get()
    {
        // The fallback authorization policy guarantees an authenticated user
        // reaches this method — UserId cannot be null here. Defensive null
        // coalescing kept for type-system honesty.
        return Ok(new MeDto(
            UserId: currentUser.UserId ?? string.Empty,
            UserName: currentUser.UserName ?? string.Empty,
            Roles: currentUser.Roles));
    }

    /// <summary>
    /// Tenant-only echo endpoint. Verifies the <c>RequireTenant</c> authorization
    /// policy fires correctly. Returns 403 for non-tenants.
    /// </summary>
    [HttpGet("tenant-only")]
    [Authorize(Policy = "RequireTenant")]
    [SwaggerOperation(Summary = "Tenant-only echo", Description = "Returns identity if caller has the Tenant role; 403 otherwise.")]
    [ProducesResponseType(typeof(MeDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public ActionResult<MeDto> GetTenantOnly()
    {
        return Ok(new MeDto(
            UserId: currentUser.UserId ?? string.Empty,
            UserName: currentUser.UserName ?? string.Empty,
            Roles: currentUser.Roles));
    }
}
