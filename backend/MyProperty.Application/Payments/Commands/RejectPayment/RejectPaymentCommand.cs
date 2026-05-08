namespace MyProperty.Application.Payments.Commands.RejectPayment;

/// <summary>
/// Landlord-initiated rejection of a Pending payment.
/// Transitions <c>Status: Pending → Rejected</c>.
/// </summary>
/// <remarks>
/// <para>
/// <c>Reason</c> is required (min 10 chars, max 500) — the whole point of a
/// rejection reason is that the tenant gets actionable information for their
/// next submission. The handler trims surrounding whitespace before persisting.
/// </para>
/// <para>
/// <b>State semantics — important:</b> in the M3 model the payment row sits
/// in <c>Rejected</c> after this handler runs. The tenant's next
/// <c>SubmitPayment</c> call accepts a <c>Rejected</c> row and transitions it
/// directly to <c>Pending</c> (clearing <c>RejectionReason</c> and
/// <c>RejectedAt</c> at that point). So the tenant UI renders
/// "your last submission was rejected because X" while
/// <c>status == 'Rejected'</c>, and the banner disappears the moment the row
/// transitions back to <c>Pending</c> on resubmission.
/// </para>
/// <para>
/// <b>Post-M3 follow-up — Model 2 migration:</b> the long-term plan is to
/// make Rejected a terminal state with a new Outstanding row created on
/// rejection (linked via a supersession FK). See <c>m3-backend-mvp.md</c>
/// post-M3 follow-ups.
/// </para>
/// </remarks>
public sealed record RejectPaymentCommand(Guid PaymentId, string Reason);

// Co-located: returned by the handler.
public sealed record PaymentRejectedDto(Guid PaymentId, DateTime RejectedAt);
