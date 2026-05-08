namespace MyProperty.Application.Common.Messaging;

/// <summary>
/// Publishes an <see cref="IIntegrationEvent"/> onto the message bus. Handlers
/// call this after the unit of work has been committed; consumers translate the
/// event into side effects (Hangfire jobs, SignalR pushes — never business
/// logic).
/// </summary>
/// <remarks>
/// <para>
/// Handlers must call <see cref="PublishAsync{T}"/> <b>after</b> the database
/// commit, never before. Publishing first risks consumers reacting to a state
/// the database does not yet contain (or never will, if the commit fails).
/// </para>
/// <para>
/// Implementations should swallow transport-level failures rather than throw —
/// the event is a side-effect signal, not the source of truth. Failing the API
/// call because RabbitMQ blinked would punish the user for an operational
/// problem. The DB row is the durable record; a missed event means a missed
/// notification, not a missed state change.
/// </para>
/// </remarks>
public interface IEventPublisher
{
    Task PublishAsync<T>(T @event, CancellationToken ct) where T : class,  IIntegrationEvent;
}
