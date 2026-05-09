using Microsoft.Extensions.Logging;
using MyProperty.Application.Common.Messaging;

namespace MyProperty.Infrastructure.Messaging;

/// <summary>
/// No-op <see cref="IEventPublisher"/> registered when <c>RabbitMq:Enabled</c>
/// is <c>false</c>. The handler call site stays the same; the message is simply
/// discarded with a debug-level log entry.
/// </summary>
/// <remarks>
/// Used in two scenarios:
/// (1) integration tests do not start a RabbitMQ container, so the test factory
/// flips the <c>Enabled</c> flag off; (2) future deploy environments where the
/// broker is intentionally absent (e.g. a static-analysis-only build).
/// </remarks>
public sealed class NullEventPublisher(ILogger<NullEventPublisher> logger) : IEventPublisher
{
    public Task PublishAsync<T>(T @event, CancellationToken ct) where T : class, IIntegrationEvent
    {
        logger.LogDebug(
            "RabbitMQ disabled — discarding {EventType} event without publishing.",
            typeof(T).Name);
        return Task.CompletedTask;
    }
}
