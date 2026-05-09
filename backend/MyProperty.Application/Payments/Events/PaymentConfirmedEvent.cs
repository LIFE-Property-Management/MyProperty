using MyProperty.Application.Common.Messaging;

namespace MyProperty.Application.Payments.Events;

/// <summary>
/// Published by <c>ConfirmPaymentHandler</c> after the Pending → Confirmed transition.
/// Confirmed is a terminal state — no further events fire on this payment row.
/// </summary>
/// <remarks>
/// <para>
/// <b>M3.7 (Hangfire) — wired in M3.8:</b> <c>PaymentConfirmedConsumer</c>
/// translates this event into a Hangfire <c>SendEmailJob</c> that delivers the
/// confirmation receipt to the tenant. Retry + DLQ behaviour is owned by the
/// existing email job; the consumer's only job is to enqueue and ack.
/// </para>
/// <para>
/// <b>M3.6 (SignalR):</b> a future consumer will also translate this event into
/// an <c>IHubContext&lt;NotificationsHub&gt;</c> push to <c>tenant:{TenantId}</c>
/// telling the tenant their payment was accepted. The frontend handler
/// invalidates the tenant dashboard query and the current-payment query so the
/// status flips to Confirmed without a manual refresh.
/// </para>
/// </remarks>
public sealed record PaymentConfirmedEvent(
    Guid PaymentId,
    Guid LeaseId,
    Guid TenantId,
    Guid LandlordId,
    decimal Amount,
    string Currency,
    DateTime ConfirmedAt) : IIntegrationEvent;
