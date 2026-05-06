namespace MyProperty.Application.Payments.Events;

/// <summary>
/// Published by <c>CreatePaymentHandler</c> after a landlord creates a new
/// Outstanding payment row against a lease.
/// </summary>
/// <remarks>
/// <para>
/// <b>M3.8 deliverable:</b> publisher wiring is pending. Until M3.8 lands, this
/// type is referenced only by the handler's TODO comment — no code path actually
/// publishes it.
/// </para>
/// <para>
/// <b>M3.6 (SignalR):</b> a consumer will translate this event into an
/// <c>IHubContext&lt;NotificationsHub&gt;</c> push to <c>tenant:{TenantId}</c>
/// notifying the tenant that a new payment is due. The frontend handler
/// invalidates the tenant dashboard query and the upcoming/current payment
/// query so the new Outstanding row appears without a manual refresh.
/// </para>
/// </remarks>
public sealed record PaymentCreatedEvent(
    Guid PaymentId,
    Guid LeaseId,
    Guid TenantId,
    Guid LandlordId,
    decimal Amount,
    string Currency,
    DateOnly DueDate,
    DateTime CreatedAt);
