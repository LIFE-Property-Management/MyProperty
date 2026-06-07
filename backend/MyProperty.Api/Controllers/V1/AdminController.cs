using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MyProperty.Application.Admin.Queries.GetStakeholderDashboard;
using Swashbuckle.AspNetCore.Annotations;

namespace MyProperty.Api.Controllers.V1;

/// <summary>
/// Admin-portal read endpoints — system-wide business KPIs for the stakeholder
/// (product-lead) dashboard. Gated on the <c>Admin</c> realm role via the
/// <c>RequireAdmin</c> policy; the data is global, not scoped to the caller.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/admin")]
[Authorize(Policy = "RequireAdmin")]
[EnableRateLimiting("authenticated")]
public sealed class AdminController(
    GetStakeholderDashboardHandler getStakeholder) : ControllerBase
{
    /// <summary>
    /// System-wide stakeholder KPIs: growth &amp; users, adoption &amp; occupancy,
    /// invite funnel, financial (per currency) and system health, plus 12-month
    /// trend series. Cached server-side (Redis, 5 min TTL).
    /// </summary>
    [HttpGet("dashboard")]
    [SwaggerOperation(
        Summary = "Stakeholder dashboard KPIs",
        Description = "Cache-aside read: returns the cached aggregate when warm, " +
                      "otherwise computes from the DB and populates the cache.")]
    [ProducesResponseType(typeof(StakeholderDashboardDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<StakeholderDashboardDto>> Dashboard(CancellationToken ct)
    {
        var result = await getStakeholder.Handle(new GetStakeholderDashboardQuery(), ct);
        return Ok(result);
    }
}
