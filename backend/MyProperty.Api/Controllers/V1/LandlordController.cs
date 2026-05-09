using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Landlord.Queries.GetLandlordDashboard;
using Swashbuckle.AspNetCore.Annotations;

namespace MyProperty.Api.Controllers.V1;

/// <summary>Landlord-portal read endpoints (dashboard aggregates etc.).</summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/landlord")]
[Authorize(Policy = "RequireLandlord")]
[EnableRateLimiting("authenticated")]
public sealed class LandlordController(
    GetLandlordDashboardHandler getDashboard,
    IUserRepository users,
    ICurrentUser currentUser) : ControllerBase
{
    /// <summary>
    /// Aggregate counters for the authenticated landlord — total properties,
    /// active leases / tenants, pending and overdue payments.
    /// Cached server-side (Redis, 60 s TTL — see M3.5).
    /// </summary>
    [HttpGet("dashboard")]
    [SwaggerOperation(
        Summary = "Landlord dashboard counters",
        Description = "Cache-aside read: returns the cached aggregate when warm, " +
                      "otherwise computes from the DB and populates the cache.")]
    [ProducesResponseType(typeof(LandlordDashboardDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<LandlordDashboardDto>> Dashboard(CancellationToken ct)
    {
        var landlord = await users.GetOrSyncFromClaimsAsync(currentUser.Principal!, ct);
        var result = await getDashboard.Handle(new GetLandlordDashboardQuery(landlord.Id), ct);
        return Ok(result);
    }
}
