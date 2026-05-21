using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MyProperty.Application.Payments.Commands.ConfirmPayment;
using MyProperty.Application.Payments.Commands.CreatePayment;
using MyProperty.Application.Payments.Commands.RejectPayment;
using MyProperty.Application.Payments.Commands.SubmitPayment;
using MyProperty.Application.Payments.Queries.DownloadReceipt;
using MyProperty.Domain.Enums;

namespace MyProperty.Api.Controllers.V1;

/// <summary>Creates and manages payments against active leases.</summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/payments")]
public sealed class PaymentsController(
    CreatePaymentHandler create,
    SubmitPaymentHandler submit,
    ConfirmPaymentHandler confirm,
    RejectPaymentHandler reject,
    DownloadReceiptHandler download) : ControllerBase
{
    /// <summary>
    /// Landlord creates an Outstanding payment row against one of their leases.
    /// </summary>
    /// <remarks>
    /// In M3 this is the manual creation endpoint used for testing.
    /// Recurring rent generation is a post-M3 follow-up — see m3-backend-mvp.md.
    /// </remarks>
    [HttpPost]
    [Authorize(Policy = "RequireLandlord")]
    [EnableRateLimiting("authenticated")]
    [ProducesResponseType(typeof(PaymentCreatedDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<PaymentCreatedDto>> Create(
        CreatePaymentCommand cmd, CancellationToken ct)
        => Ok(await create.Handle(cmd, ct));

    /// <summary>
    /// Tenant submits payment proof against an Outstanding payment.
    /// Transitions Outstanding → Pending. Accepts <c>multipart/form-data</c>
    /// so a receipt image/PDF can be attached when <c>Method == ReceiptUpload</c>.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>Form fields</b>: <c>Method</c> (required, enum), <c>Notes</c> (optional),
    /// and <c>File</c> (required when <c>Method == ReceiptUpload</c>, forbidden
    /// when <c>Method == ManualRequest</c>; rules enforced by the validator).
    /// </para>
    /// <para>
    /// <b>Limits</b>: <see cref="RequestSizeLimitAttribute"/> caps the request
    /// at 6 MB so Kestrel rejects oversized uploads with 413 before any of our
    /// code runs. The validator additionally enforces the 5 MB business limit
    /// to produce a 400 with the standard ValidationProblemDetails envelope.
    /// </para>
    /// </remarks>
    [HttpPost("{id:guid}/submit")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(6L * 1024 * 1024)]
    [Authorize(Policy = "RequireTenant")]
    [EnableRateLimiting("authenticated")]
    [ProducesResponseType(typeof(PaymentSubmittedDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status413PayloadTooLarge)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<PaymentSubmittedDto>> Submit(
        Guid id,
        [FromForm] PaymentMethod method,
        [FromForm] string? notes,
        IFormFile? file,
        CancellationToken ct)
    {
        Stream? fileStream = file?.OpenReadStream();
        try
        {
            var cmd = new SubmitPaymentCommand(
                PaymentId: id,
                Method: method,
                Notes: notes,
                FileStream: fileStream,
                FileName: file?.FileName,
                ContentType: file?.ContentType,
                FileSizeBytes: file?.Length);

            return Ok(await submit.Handle(cmd, ct));
        }
        finally
        {
            if (fileStream is not null)
                await fileStream.DisposeAsync();
        }
    }

    /// <summary>
    /// Landlord confirms a Pending payment. Transitions Pending → Confirmed.
    /// Confirmed is terminal — no further state transitions are valid.
    /// </summary>
    [HttpPost("{id:guid}/confirm")]
    [Authorize(Policy = "RequireLandlord")]
    [EnableRateLimiting("authenticated")]
    [ProducesResponseType(typeof(PaymentConfirmedDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<PaymentConfirmedDto>> Confirm(
        Guid id, CancellationToken ct)
        => Ok(await confirm.Handle(new ConfirmPaymentCommand(id), ct));

    /// <summary>
    /// Landlord rejects a Pending payment with a required reason.
    /// Transitions Pending → Rejected. The row stays in Rejected until the
    /// tenant's next submission, which transitions it directly to Pending
    /// (Submit accepts both Outstanding and Rejected; RejectionReason and
    /// RejectedAt are cleared on entry to Pending).
    /// </summary>
    [HttpPost("{id:guid}/reject")]
    [Authorize(Policy = "RequireLandlord")]
    [EnableRateLimiting("authenticated")]
    [ProducesResponseType(typeof(PaymentRejectedDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<PaymentRejectedDto>> Reject(
        Guid id,
        [FromBody] RejectPaymentRequestBody body,
        CancellationToken ct)
        => Ok(await reject.Handle(new RejectPaymentCommand(id, body.Reason), ct));

    /// <summary>
    /// Download the receipt attached to a payment. Streams inline so the
    /// browser renders images/PDFs in-tab.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>Authorization</b>: caller must be the tenant on the payment's lease
    /// or the landlord that owns the lease's property. Anyone else: 403.
    /// </para>
    /// <para>
    /// <b>Resolution</b>: 404 when the payment does not exist or has no
    /// receipt attached (<c>ManualRequest</c> submissions).
    /// </para>
    /// </remarks>
    [HttpGet("{id:guid}/receipt")]
    [Authorize]
    [EnableRateLimiting("authenticated")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> DownloadReceipt(
        Guid id,
        CancellationToken ct)
    {
        var result = await download.Handle(id, ct);
        Response.Headers.ContentDisposition =
            $"inline; filename=\"{Uri.EscapeDataString(result.FileName)}\"";
        return File(result.Content, result.ContentType);
    }

    // Inline request body — route param `id` is the source of truth for PaymentId,
    // body carries the rest. (Submit uses [FromForm] for multipart and has no body record.)
    public sealed record RejectPaymentRequestBody(string Reason);
}
