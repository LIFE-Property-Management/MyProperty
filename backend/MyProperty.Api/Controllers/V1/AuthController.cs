using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MyProperty.Application.Auth.Commands.RegisterLandlord;

namespace MyProperty.Api.Controllers.V1;

/// <summary>Public auth endpoints — no JWT required.</summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/auth")]
[AllowAnonymous]
public sealed class AuthController(RegisterLandlordHandler register) : ControllerBase
{
    /// <summary>Creates a new landlord account in Keycloak. Does not log the user in — redirect to /login after success.</summary>
    [HttpPost("register-landlord")]
    [EnableRateLimiting("anon-invite")]
    [ProducesResponseType(typeof(RegisterLandlordResultDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<RegisterLandlordResultDto>> RegisterLandlord(
        RegisterLandlordCommand cmd, CancellationToken ct)
        => CreatedAtAction(null, await register.Handle(cmd, ct));
}
