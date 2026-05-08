namespace MyProperty.Application.Common.Messaging;

/// <summary>
/// Marker for events that cross the in-process boundary onto the message bus
/// (RabbitMQ in M3.8). Applied to records under <c>Application/&lt;Feature&gt;/Events/</c>.
/// </summary>
/// <remarks>
/// Implementing this marker is what makes a record publishable via
/// <see cref="IEventPublisher"/>. The publisher derives the routing key from the
/// CLR type name (see infrastructure layer), so the type name itself is part of
/// the public contract — renaming an event is a breaking change for consumers.
/// </remarks>
public interface IIntegrationEvent;
