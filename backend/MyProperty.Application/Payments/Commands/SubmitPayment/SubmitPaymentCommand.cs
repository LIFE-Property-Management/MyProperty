using MyProperty.Domain.Enums;

namespace MyProperty.Application.Payments.Commands.SubmitPayment;

/// <summary>
/// Tenant-initiated submission against an Outstanding payment.
/// Transitions <c>Status: Outstanding → Pending</c>.
/// </summary>
/// <remarks>
/// <para>
/// <b>File handling (M3.9):</b> when <c>Method == ReceiptUpload</c> the command
/// MUST carry a non-null <see cref="FileStream"/> together with
/// <see cref="FileName"/>, <see cref="ContentType"/> and
/// <see cref="FileSizeBytes"/>; the validator rejects mismatches with 400.
/// When <c>Method == ManualRequest</c> the file fields MUST be null —
/// manual cash submissions are fileless by definition. The handler streams
/// <see cref="FileStream"/> through <see cref="MyProperty.Application.Common.Interfaces.IFileStorage"/>
/// and persists the returned key on the <c>Payment</c> row.
/// </para>
/// <para>
/// <b>Future change (post-M3, two-step upload):</b> the long-term plan is to
/// split file upload into a dedicated endpoint that returns a key, then have
/// submit accept the key alone. This batch ships the single-step multipart
/// flow because there is only one file consumer in M3 and the abstraction
/// cost isn't justified yet.
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
    string? Notes,
    Stream? FileStream,
    string? FileName,
    string? ContentType,
    long? FileSizeBytes);

// Co-located: returned by the handler.
public sealed record PaymentSubmittedDto(Guid PaymentId, DateTime SubmittedAt);
