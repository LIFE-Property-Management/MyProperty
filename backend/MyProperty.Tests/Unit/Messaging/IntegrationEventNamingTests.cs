using MyProperty.Application.Common.Messaging;
using MyProperty.Application.Payments.Events;
using MyProperty.Infrastructure.Messaging;

namespace MyProperty.Tests.Unit.Messaging;

/// <summary>
/// Locks down the routing-key derivation used by both the publisher and the
/// consumers. Renaming an event type is a breaking change for the topology —
/// these assertions surface that immediately rather than at runtime.
/// </summary>
public class IntegrationEventNamingTests
{
    [Theory]
    [InlineData(typeof(PaymentSubmittedEvent), "payment.submitted")]
    [InlineData(typeof(PaymentConfirmedEvent), "payment.confirmed")]
    [InlineData(typeof(PaymentRejectedEvent),  "payment.rejected")]
    [InlineData(typeof(PaymentCreatedEvent),   "payment.created")]
    public void RoutingKey_StripsEventSuffix_AndDottedLowerCase(Type eventType, string expected)
    {
        Assert.Equal(expected, IntegrationEventNaming.RoutingKey(eventType));
    }

    [Fact]
    public void RoutingKey_TypeWithoutEventSuffix_StillCamelSplit()
    {
        Assert.Equal("invite.accepted", IntegrationEventNaming.RoutingKey(typeof(InviteAcceptedEvent)));
    }

    [Fact]
    public void RoutingKey_NullType_Throws()
    {
        Assert.Throws<ArgumentNullException>(() => IntegrationEventNaming.RoutingKey(null!));
    }

    private sealed record InviteAcceptedEvent(Guid InviteId) : IIntegrationEvent;
}
