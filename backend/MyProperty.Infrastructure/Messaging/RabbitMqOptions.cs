using System.ComponentModel.DataAnnotations;

namespace MyProperty.Infrastructure.Messaging;

/// <summary>
/// RabbitMQ connection + topology config bound from the <c>RabbitMq</c> section.
/// </summary>
public sealed class RabbitMqOptions
{
    public const string SectionName = "RabbitMq";

    /// <summary>
    /// Master switch. <c>false</c> registers the no-op publisher and skips the
    /// consumer hosted service — used by the test factory so the suite does not
    /// need a RabbitMQ container.
    /// </summary>
    public bool Enabled { get; set; } = true;

    [Required]
    public required string HostName { get; set; }

    [Range(1, 65535)]
    public int Port { get; set; } = 5672;

    [Required]
    public required string UserName { get; set; }

    [Required]
    public required string Password { get; set; }

    public string VirtualHost { get; set; } = "/";

    /// <summary>
    /// Topic exchange that receives every <see cref="MyProperty.Application.Common.Messaging.IIntegrationEvent"/>.
    /// Routing keys are derived from the event type name — e.g.
    /// <c>PaymentConfirmedEvent</c> → <c>payment.confirmed</c>.
    /// </summary>
    [Required]
    public string Exchange { get; set; } = "myproperty.events";
}
