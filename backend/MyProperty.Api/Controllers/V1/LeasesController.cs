using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MyProperty.Application.Common;
using MyProperty.Application.Leases.Commands.TerminateLease;
using MyProperty.Application.Leases.Queries.GetLandlordLeases;
using MyProperty.Application.Leases.Queries.GetLeasesExpiringSoon;
using Swashbuckle.AspNetCore.Annotations;

namespace MyProperty.Api.Controllers.V1;

/// <summary>Lease management endpoints.</summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/leases")]
[Authorize(Policy = "RequireLandlord")]
[EnableRateLimiting("authenticated")]
public sealed class LeasesController(
    GetLandlordLeasesHandler getLandlordLeases,
    GetLeasesExpiringSoonHandler getLeasesExpiringSoon,
    TerminateLeaseHandler terminateLease) : ControllerBase
{
    /// <summary>Returns a paginated list of leases for the authenticated landlord.</summary>
    [HttpGet]
    [SwaggerOperation(Summary = "List landlord leases")]
    [ProducesResponseType(typeof(PagedResult<LeaseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<PagedResult<LeaseDto>>> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var result = await getLandlordLeases.Handle(
            new GetLandlordLeasesQuery(page, pageSize), ct);
        return Ok(result);
    }

    /// <summary>
    /// Returns active leases expiring within the given threshold (default 30 days),
    /// ordered by EndDate ascending. Drives the "Leases Expiring Soon" action table.
    /// </summary>
    [HttpGet("expiring-soon")]
    [SwaggerOperation(Summary = "Leases expiring soon")]
    [ProducesResponseType(typeof(IReadOnlyList<ExpiringLeaseDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<IReadOnlyList<ExpiringLeaseDto>>> ExpiringSoon(
        [FromQuery] int daysThreshold = 30,
        CancellationToken ct = default)
    {
        var result = await getLeasesExpiringSoon.Handle(
            new GetLeasesExpiringSoonQuery(daysThreshold), ct);
        return Ok(result);
    }

    /// <summary>Terminates a lease. Only the landlord who owns the lease may call this.</summary>
    [HttpPatch("{id:guid}/terminate")]
    [SwaggerOperation(Summary = "Terminate lease")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Terminate(Guid id, CancellationToken ct)
    {
        await terminateLease.Handle(new TerminateLeaseCommand(id), ct);
        return NoContent();
    }
}
