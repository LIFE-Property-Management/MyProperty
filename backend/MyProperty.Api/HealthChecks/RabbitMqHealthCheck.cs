using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.DependencyInjection;
using MyProperty.Infrastructure.Messaging;

namespace MyProperty.Api.HealthChecks;

/// <summary>
/// Diagnostic check only — does not block /ready. Verifies RabbitMQ is reachable
/// by opening a channel on the process-wide shared connection.
/// </summary>
/// <remarks>
/// Reuses <see cref="RabbitMqConnectionProvider"/> — the same singleton connection
/// the publisher and consumers share — instead of opening a fresh connection per
/// probe. The previous <c>AddRabbitMQ(factory: ...)</c> registration created a new
/// <see cref="RabbitMQ.Client.IConnection"/> on every health check and never
/// disposed it; under a 60s monitor poll that exhausted the broker's socket file
/// descriptors within hours, tripping a file-descriptor alarm that blocked all new
/// connections. Channels are cheap and do not consume a new socket, so opening one
/// here is the correct liveness signal.
///
/// The provider is resolved optionally: when messaging is disabled
/// (<c>RabbitMq:Enabled=false</c>, e.g. the integration test fixture) it is not
/// registered, so the check reports unhealthy rather than failing to construct.
/// </remarks>
internal sealed class RabbitMqHealthCheck(IServiceProvider services) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var connections = services.GetService<RabbitMqConnectionProvider>();
        if (connections is null)
            return HealthCheckResult.Unhealthy("RabbitMQ messaging is disabled");

        try
        {
            var connection = await connections.GetConnectionAsync(cancellationToken);
            await using var channel = await connection.CreateChannelAsync(cancellationToken: cancellationToken);

            return connection.IsOpen
                ? HealthCheckResult.Healthy("RabbitMQ connection open")
                : HealthCheckResult.Unhealthy("RabbitMQ connection is not open");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("RabbitMQ unreachable", ex);
        }
    }
}
