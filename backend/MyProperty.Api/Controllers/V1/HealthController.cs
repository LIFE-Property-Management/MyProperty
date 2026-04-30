using Asp.Versioning;
using Microsoft.AspNetCore.Mvc;
using Swashbuckle.AspNetCore.Annotations;

namespace MyProperty.Api.Controllers.V1;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/health")]
public class HealthController : ControllerBase
{
    [HttpGet]
    [SwaggerOperation(Summary = "Liveness probe", Description = "Returns 200 if the API process is up.")]
    [ProducesResponseType(typeof(HealthResponse), StatusCodes.Status200OK)]
    public ActionResult<HealthResponse> Get()
        => Ok(new HealthResponse("ok", DateTimeOffset.UtcNow));
}

public sealed record HealthResponse(string Status, DateTimeOffset Timestamp);
