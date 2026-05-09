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
/// data. <c>ReceiptFileKey</c> is on the payload so the consumer can fetch the
/// file via <c>IFileStorage.DownloadAsync</c> without a DB round-trip;
/// <c>PaymentId</c> is needed for the write-back of OCR results. The consumer
/// must skip events whose <c>ReceiptFileKey</c> is null
/// (<c>Method == ManualRequest</c> submissions).
/// </para>
/// </remarks>
public sealed record PaymentSubmittedEvent(
    Guid PaymentId,
    Guid LeaseId,
    Guid TenantId,
    Guid LandlordId,
    decimal Amount,
    string Currency,
    DateTime SubmittedAt,
    string? ReceiptFileKey) : IIntegrationEvent;
