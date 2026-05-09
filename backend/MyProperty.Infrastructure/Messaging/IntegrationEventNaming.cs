using System.Globalization;
using System.Text;

namespace MyProperty.Infrastructure.Messaging;

/// <summary>
/// Translates an event type into the routing key + queue suffix used on the
/// RabbitMQ topology. The naming is dotted, lowercase, and excludes the trailing
/// <c>Event</c> suffix.
/// </summary>
/// <example>
/// <c>PaymentConfirmedEvent</c> → <c>payment.confirmed</c>;
/// <c>InviteAcceptedEvent</c>  → <c>invite.accepted</c>.
/// </example>
public static class IntegrationEventNaming
{
    private const string EventSuffix = "Event";

    public static string RoutingKey(Type eventType)
    {
        ArgumentNullException.ThrowIfNull(eventType);

        var name = eventType.Name;
        if (name.EndsWith(EventSuffix, StringComparison.Ordinal))
            name = name[..^EventSuffix.Length];

        // Insert dots between camel-cased boundaries: PaymentConfirmed → Payment.Confirmed.
        var sb = new StringBuilder(name.Length + 4);
        for (var i = 0; i < name.Length; i++)
        {
            var c = name[i];
            if (i > 0 && char.IsUpper(c))
                sb.Append('.');
            sb.Append(char.ToLower(c, CultureInfo.InvariantCulture));
        }

        return sb.ToString();
    }
}
