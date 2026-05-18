using MyProperty.Application.Common.Messaging;

namespace MyProperty.Tests.Integration.Fixtures;

internal sealed class NullEventPublisher : IEventPublisher
{
    public Task PublishAsync<T>(T @event, CancellationToken ct) where T : class, IIntegrationEvent
        => Task.CompletedTask;
}
