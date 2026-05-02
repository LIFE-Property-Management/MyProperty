namespace MyProperty.Application.Health;

/// <summary>
/// Liveness probe response payload for <c>GET /api/v1/health</c>.
/// </summary>
/// <param name="Status">Always "ok" when the process is responsive.</param>
/// <param name="Timestamp">Server time at which the response was generated.</param>
public sealed record HealthResponse(string Status, DateTimeOffset Timestamp);
