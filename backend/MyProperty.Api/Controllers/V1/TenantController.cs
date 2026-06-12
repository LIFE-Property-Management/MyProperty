using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MyProperty.Application.Leases.Commands.CancelOwnLease;
using MyProperty.Application.Leases.Queries.GetTenantLease;
using Swashbuckle.AspNetCore.Annotations;

namespace MyProperty.Api.Controllers.V1;

/// <summary>
/// Tenant-only endpoints (the tenant portal surface). Owns the authenticated
/// tenant's own-lease read and lease cancellation. Identity / user-row upsert
/// stays on <see cref="UsersController"/> (<c>/me</c>).
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/tenant")]
[Authorize(Policy = "RequireTenant")]
[EnableRateLimiting("authenticated")]
public sealed class TenantController(
    GetTenantLeaseHandler getTenantLease,
    CancelOwnLeaseHandler cancelOwnLease) : ControllerBase
{
    /// <summary>
    /// Returns the active lease for the authenticated tenant.
    /// Returns 204 if the tenant has no active lease.
    /// </summary>
    [HttpGet("lease")]
    [SwaggerOperation(
        Summary = "Active lease for current tenant",
        Description = "Returns the tenant's active lease summary, or 204 if none exists.")]
    [ProducesResponseType(typeof(TenantLeaseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<TenantLeaseDto>> Lease(CancellationToken ct)
    {
        var result = await getTenantLease.Handle(new GetTenantLeaseQuery(), ct);
        if (result is null)
            return NoContent();
        return Ok(result);
    }

    /// <summary>
    /// Cancels the authenticated tenant's own active lease (immediate
    /// self-service termination). The landlord is notified by email.
    /// </summary>
    [HttpPost("lease/cancel")]
    [SwaggerOperation(
        Summary = "Cancel own lease",
        Description = "Terminates the authenticated tenant's active lease immediately " +
                      "and emails the landlord. 404 if the tenant has no active lease.")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CancelLease(CancellationToken ct)
    {
        await cancelOwnLease.Handle(new CancelOwnLeaseCommand(), ct);
        return NoContent();
    }
}
