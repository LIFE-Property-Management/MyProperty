using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MyProperty.Application.Stats.Queries.GetPublicStats;
using Swashbuckle.AspNetCore.Annotations;

namespace MyProperty.Api.Controllers.V1;

/// <summary>
/// Public read endpoints for the landing page. No authentication required.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/stats")]
[AllowAnonymous]
[EnableRateLimiting("anon-invite")]
public sealed class StatsController(GetPublicStatsHandler getPublicStats) : ControllerBase
{
    /// <summary>
    /// Aggregate stats shown on the public landing page: total rent collected,
    /// properties managed, and landlords onboarded.
    /// </summary>
    [HttpGet("public")]
    [SwaggerOperation(
        Summary = "Public landing-page stats",
        Description = "Unauthenticated aggregate counters for the landing page.")]
    [ProducesResponseType(typeof(PublicStatsDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<PublicStatsDto>> Public(CancellationToken ct)
    {
        var result = await getPublicStats.Handle(new GetPublicStatsQuery(), ct);
        return Ok(result);
    }
}
