using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MyProperty.Application.Payments.Commands.ConfirmPayment;
using MyProperty.Application.Payments.Commands.CreatePayment;
using MyProperty.Application.Payments.Commands.RejectPayment;
using MyProperty.Application.Payments.Commands.SubmitPayment;
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
    RejectPaymentHandler reject) : ControllerBase
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
    /// Transitions Outstanding → Pending.
    /// </summary>
    /// <remarks>
    /// Currently accepts <c>application/json</c> only. M3.9 will extend to
    /// <c>multipart/form-data</c> for receipt file uploads.
    /// </remarks>
    [HttpPost("{id:guid}/submit")]
    [Authorize(Policy = "RequireTenant")]
    [EnableRateLimiting("authenticated")]
    [ProducesResponseType(typeof(PaymentSubmittedDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<PaymentSubmittedDto>> Submit(
        Guid id,
        [FromBody] SubmitPaymentRequestBody body,
        CancellationToken ct)
        => Ok(await submit.Handle(new SubmitPaymentCommand(id, body.Method, body.Notes), ct));

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

    // Inline request body so the route param `id` is the source of truth for PaymentId,
    // not the body. Matches the convention used in InvitesController for /accept and /reject.
    public sealed record SubmitPaymentRequestBody(PaymentMethod Method, string? Notes);

    // Inline request body — same convention as SubmitPaymentRequestBody:
    // route param `id` is the source of truth for PaymentId, body carries the rest.
    public sealed record RejectPaymentRequestBody(string Reason);
}
