namespace MyProperty.Application.Payments.Events;

/// <summary>
/// Published by <c>RejectPaymentHandler</c> after the Pending → Rejected transition.
/// </summary>
/// <remarks>
/// <para>
/// <b>State semantics — important:</b> in the M3 model the payment row sits
/// in <c>Rejected</c> after this event fires, until the tenant's next
/// <c>SubmitPayment</c> call transitions it directly to <c>Pending</c>
/// (the <c>Submit</c> state guard accepts both <c>Outstanding</c> and
/// <c>Rejected</c>, and clears <c>RejectionReason</c>/<c>RejectedAt</c>
/// on entry to <c>Pending</c>). The row identified by <c>PaymentId</c>
/// is not immutable in M3.
/// </para>
/// <para>
/// <b>Post-M3 follow-up — Model 2 migration:</b> the long-term plan is to make
/// Rejected a terminal state with a new Outstanding row created on rejection
/// (linked via a supersession FK). When that lands, this event's semantics
/// stay the same but the row identified by <c>PaymentId</c> becomes immutable.
/// See <c>m3-backend-mvp.md</c> post-M3 follow-ups.
/// </para>
/// <para>
/// <b>M3.8 deliverable:</b> publisher wiring is pending. Until M3.8 lands, this
/// type is referenced only by the handler's TODO comment.
/// </para>
/// <para>
/// <b>M3.6 (SignalR):</b> a consumer will translate this event into an
/// <c>IHubContext&lt;NotificationsHub&gt;</c> push to <c>tenant:{TenantId}</c>
/// so the tenant sees the rejection — and reason — without a manual refresh.
/// </para>
/// </remarks>
public sealed record PaymentRejectedEvent(
    Guid PaymentId,
    Guid LeaseId,
    Guid TenantId,
    Guid LandlordId,
    decimal Amount,
    string Currency,
    string Reason,
    DateTime RejectedAt);
