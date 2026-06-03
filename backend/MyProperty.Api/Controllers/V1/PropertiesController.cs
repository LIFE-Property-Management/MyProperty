using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MyProperty.Application.Common;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Properties.Commands.CreateProperty;
using MyProperty.Application.Properties.Commands.DeleteProperty;
using MyProperty.Application.Properties.Commands.UpdateProperty;
using MyProperty.Application.Properties.Queries.GetLandlordProperties;
using MyProperty.Application.Properties.Queries.GetPropertyById;
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
    GetPropertyByIdHandler getPropertyById,
    UpdatePropertyHandler updateProperty,
    DeletePropertyHandler deleteProperty,
    IUserRepository users,
    ICurrentUser currentUser) : ControllerBase
{
    /// <summary>Creates a new property for the authenticated landlord.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(PropertyCreatedDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<PropertyCreatedDto>> Create(
        [FromBody] CreatePropertyRequest request, CancellationToken ct)
    {
        var landlord = await users.GetOrSyncFromClaimsAsync(currentUser.Principal!, ct);
        var cmd = new CreatePropertyCommand(request.Name, request.Address, request.UnitNumber, request.PropertyType);
        var result = await createProperty.Handle(cmd, ct);
        return CreatedAtAction(nameof(List), new { }, result);
    }

    /// <summary>Returns detail for a specific property including all tenants and leases.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(PropertyDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<PropertyDetailDto>> GetById(Guid id, CancellationToken ct)
    {
        var landlord = await users.GetOrSyncFromClaimsAsync(currentUser.Principal!, ct);
        var result = await getPropertyById.Handle(new GetPropertyByIdQuery(id, landlord.Id), ct);
        return Ok(result);
    }

    /// <summary>Updates name, address, unit number and type of an existing property.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePropertyRequest request, CancellationToken ct)
    {
        await users.GetOrSyncFromClaimsAsync(currentUser.Principal!, ct);
        await updateProperty.Handle(
            new UpdatePropertyCommand(id, request.Name, request.Address, request.UnitNumber, request.PropertyType), ct);
        return NoContent();
    }

    /// <summary>Soft-deletes a property owned by the authenticated landlord.</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await users.GetOrSyncFromClaimsAsync(currentUser.Principal!, ct);
        await deleteProperty.Handle(id, ct);
        return NoContent();
    }

    /// <summary>Returns a paginated list of properties owned by the authenticated landlord.</summary>
    [HttpGet]
    [SwaggerOperation(Summary = "List landlord properties")]
    [ProducesResponseType(typeof(PagedResult<PropertyDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<PropertyDto>>> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        CancellationToken ct = default)
    {
        var landlord = await users.GetOrSyncFromClaimsAsync(currentUser.Principal!, ct);
        var result = await getLandlordProperties.Handle(new GetLandlordPropertiesQuery(page, pageSize), ct);
        return Ok(result);
    }
}

public sealed record UpdatePropertyRequest(
    string Name,
    string Address,
    string? UnitNumber,
    MyProperty.Domain.Enums.PropertyType PropertyType);
