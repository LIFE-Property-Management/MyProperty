namespace MyProperty.Application.Payments.Events;

/// <summary>
/// Published by <c>ConfirmPaymentHandler</c> after the Pending → Confirmed transition.
/// Confirmed is a terminal state — no further events fire on this payment row.
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
/// telling the tenant their payment was accepted. The frontend handler
/// invalidates the tenant dashboard query and the current-payment query so the
/// status flips to Confirmed without a manual refresh.
/// </para>
/// <para>
/// <b>M3.7 (Hangfire):</b> the same M3.8 consumer also enqueues a confirmation
/// email job (see backend/CLAUDE.md "Worked example — landlord confirms a payment").
/// </para>
/// </remarks>
public sealed record PaymentConfirmedEvent(
    Guid PaymentId,
    Guid LeaseId,
    Guid TenantId,
    Guid LandlordId,
    decimal Amount,
    string Currency,
    DateTime ConfirmedAt);
