using MyProperty.Application.Common.Messaging;

namespace MyProperty.Application.Payments.Events;

/// <summary>
/// Published by <c>SubmitPaymentHandler</c> after the Outstanding → Pending transition.
/// </summary>
/// <remarks>
/// <para>
/// <b>M3.6 (SignalR):</b> a consumer will translate this event into an
/// <c>IHubContext&lt;NotificationsHub&gt;</c> push to <c>landlord:{LandlordId}</c>
/// with the same payload, telling the landlord their tenant has submitted a payment.
/// </para>
/// <para>
/// <b>M3.10 (OCR):</b> a separate consumer will subscribe to extract receipt
/// data once M3.9 stores files. The OCR consumer will need <c>PaymentId</c> only
/// to look up the receipt; the rest of the payload is for the SignalR consumer.
/// </para>
/// </remarks>
public sealed record PaymentSubmittedEvent(
    Guid PaymentId,
    Guid LeaseId,
    Guid TenantId,
    Guid LandlordId,
    decimal Amount,
    string Currency,
    DateTime SubmittedAt) : IIntegrationEvent;
