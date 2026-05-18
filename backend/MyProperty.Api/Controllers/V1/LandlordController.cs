using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MyProperty.Application.Common;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Landlord.Queries.GetLandlordDashboard;
using MyProperty.Application.Landlord.Queries.GetLandlordTenants;
using MyProperty.Application.Landlord.Queries.GetTenantDetail;
using Swashbuckle.AspNetCore.Annotations;

namespace MyProperty.Api.Controllers.V1;

/// <summary>Landlord-portal read endpoints (dashboard aggregates, tenants etc.).</summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/landlord")]
[Authorize(Policy = "RequireLandlord")]
[EnableRateLimiting("authenticated")]
public sealed class LandlordController(
    GetLandlordDashboardHandler getDashboard,
    GetLandlordTenantsHandler getLandlordTenants,
    GetTenantDetailHandler getTenantDetail,
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

    /// <summary>Returns a paginated list of tenants (via leases) for the authenticated landlord.</summary>
    [HttpGet("tenants")]
    [SwaggerOperation(Summary = "List landlord tenants")]
    [ProducesResponseType(typeof(PagedResult<LandlordTenantDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<PagedResult<LandlordTenantDto>>> Tenants(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var landlord = await users.GetOrSyncFromClaimsAsync(currentUser.Principal!, ct);
        var result = await getLandlordTenants.Handle(
            new GetLandlordTenantsQuery( page, pageSize), ct);
        return Ok(result);
    }

    /// <summary>
    /// Returns detailed info for a specific tenant including their lease and full payment history.
    /// Returns 404 if the tenant has no lease with the authenticated landlord.
    /// </summary>
    [HttpGet("tenants/{id:guid}")]
    [SwaggerOperation(Summary = "Tenant detail")]
    [ProducesResponseType(typeof(TenantDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TenantDetailDto>> TenantDetail(Guid id, CancellationToken ct)
    {
        var landlord = await users.GetOrSyncFromClaimsAsync(currentUser.Principal!, ct);
        var result = await getTenantDetail.Handle(new GetTenantDetailQuery(id), ct);
        return Ok(result);
    }
}
