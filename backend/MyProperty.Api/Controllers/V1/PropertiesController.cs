using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MyProperty.Application.Common;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Properties.Commands.CreateProperty;
using MyProperty.Application.Properties.Queries.GetLandlordProperties;
using Swashbuckle.AspNetCore.Annotations;

namespace MyProperty.Api.Controllers.V1;

/// <summary>Property management endpoints for landlords.</summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/properties")]
[Authorize(Policy = "RequireLandlord")]
[EnableRateLimiting("authenticated")]
public sealed class PropertiesController(
    CreatePropertyHandler createProperty,
    GetLandlordPropertiesHandler getLandlordProperties,
    IUserRepository users,
    ICurrentUser currentUser) : ControllerBase
{
    /// <summary>Creates a new property for the authenticated landlord.</summary>
    [HttpPost]
    [SwaggerOperation(Summary = "Create property")]
    [ProducesResponseType(typeof(PropertyCreatedDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<PropertyCreatedDto>> Create(
        [FromBody] CreatePropertyRequest request, CancellationToken ct)
    {
        var landlord = await users.GetOrSyncFromClaimsAsync(currentUser.Principal!, ct);
        var cmd = new CreatePropertyCommand( request.Name, request.Address, request.UnitNumber);
        var result = await createProperty.Handle(cmd, ct);
        return CreatedAtAction(nameof(List), new { }, result);
    }

    /// <summary>Returns a paginated list of properties owned by the authenticated landlord.</summary>
    [HttpGet]
    [SwaggerOperation(Summary = "List landlord properties")]
    [ProducesResponseType(typeof(PagedResult<PropertyDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<PagedResult<PropertyDto>>> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var landlord = await users.GetOrSyncFromClaimsAsync(currentUser.Principal!, ct);
        var result = await getLandlordProperties.Handle(
            new GetLandlordPropertiesQuery( page, pageSize), ct);
        return Ok(result);
    }
}
