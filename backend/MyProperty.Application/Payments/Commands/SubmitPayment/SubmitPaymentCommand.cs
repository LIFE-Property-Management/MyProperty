using MyProperty.Domain.Enums;

namespace MyProperty.Application.Payments.Commands.SubmitPayment;

/// <summary>
/// Tenant-initiated submission against an Outstanding payment.
/// Transitions <c>Status: Outstanding → Pending</c>.
/// </summary>
/// <remarks>
/// <para>
/// <b>M3.9 (file upload) — receipt is NOT accepted in this batch.</b>
/// When <c>Method == ReceiptUpload</c>, no file is currently persisted —
/// <c>ReceiptFileKey</c> and <c>ReceiptFileName</c> remain null. M3.9 batch must
/// either (a) extend this command to accept <c>IFormFile</c> and plumb through
/// <c>IFileStorage</c>, or (b) add a separate <c>AttachReceiptCommand</c>
/// invoked after submit. Decision deferred to M3.9.
/// </para>
/// <para>
/// <b>M3.9 must also enforce</b>: <c>ReceiptUpload</c> submissions with no file
/// are currently allowed; M3.9 must reject them. <c>ManualRequest</c> remains
/// fileless by definition.
/// </para>
/// <para>
/// <b>State semantics on resubmission after a previous rejection:</b>
/// when a previously-Rejected payment loops back to Outstanding,
/// <c>RejectionReason</c> and <c>RejectedAt</c> are intentionally preserved so
/// the tenant UI can show "your last submission was rejected because X" until
/// the tenant submits again. THIS handler clears those fields on a new submit.
/// </para>
/// </remarks>
public sealed record SubmitPaymentCommand(
    Guid PaymentId,
    PaymentMethod Method,
    string? Notes);

// Co-located: returned by the handler.
public sealed record PaymentSubmittedDto(Guid PaymentId, DateTime SubmittedAt);
