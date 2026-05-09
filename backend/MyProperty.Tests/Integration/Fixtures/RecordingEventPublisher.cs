using System.Collections.Concurrent;
using MyProperty.Application.Common.Messaging;

namespace MyProperty.Tests.Integration.Fixtures;

/// <summary>
/// Test substitute for <see cref="IEventPublisher"/>: captures every integration
/// event the production code attempts to publish without touching RabbitMQ.
/// Tests assert on the recorded payloads to verify handler → event wiring.
/// </summary>
internal sealed class RecordingEventPublisher : IEventPublisher
{
    private readonly ConcurrentQueue<IIntegrationEvent> _events = new();

    public IReadOnlyCollection<IIntegrationEvent> Events => _events.ToArray();

    public Task PublishAsync<T>(T @event, CancellationToken ct) where T : class, IIntegrationEvent
    {
        _events.Enqueue(@event);
        return Task.CompletedTask;
    }

    public void Clear()
    {
        while (_events.TryDequeue(out _)) { }
    }
}
