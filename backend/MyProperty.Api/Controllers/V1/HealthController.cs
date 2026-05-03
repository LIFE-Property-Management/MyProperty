using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyProperty.Application.Health;
using Swashbuckle.AspNetCore.Annotations;

namespace MyProperty.Api.Controllers.V1;

[AllowAnonymous]
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/health")]
public sealed class HealthController : ControllerBase
{
    [HttpGet]
    [SwaggerOperation(Summary = "Liveness probe", Description = "Returns 200 if the API process is up.")]
    [ProducesResponseType(typeof(HealthResponse), StatusCodes.Status200OK)]
    public ActionResult<HealthResponse> Get()
        => Ok(new HealthResponse("ok", DateTimeOffset.UtcNow));
}
