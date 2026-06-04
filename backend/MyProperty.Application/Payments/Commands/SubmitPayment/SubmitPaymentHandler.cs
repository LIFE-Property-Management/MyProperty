using FluentValidation;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Messaging;
using MyProperty.Application.Common.Validation;
using MyProperty.Application.Payments.Events;
using MyProperty.Domain.Enums;

namespace MyProperty.Application.Payments.Commands.SubmitPayment;

public sealed class SubmitPaymentHandler(
    IValidator<SubmitPaymentCommand> validator,
    ICurrentUserContext currentUserContext,
    IPaymentRepository paymentRepo,
    ILandlordDashboardCache dashboardCache,
    IEventPublisher events,
    IFileStorage fileStorage)
{
    public async Task<PaymentSubmittedDto> Handle(SubmitPaymentCommand cmd, CancellationToken ct)
    {
        await validator.EnsureValidAsync(cmd, ct);

        // Resource-scoped authorization: tenant must own the lease this payment is on.
        var tenant = await currentUserContext.GetUserAsync(ct);

        var payment = await paymentRepo.GetByIdWithLeaseAsync(cmd.PaymentId, ct)
            ?? throw new NotFoundException("Payment", cmd.PaymentId);

        if (payment.Lease!.TenantId != tenant.Id)
            throw new ForbiddenException("You cannot submit against a payment that is not on your lease.");

        // State machine guard: tenant can submit against an Outstanding payment
        // (initial submission) or a Rejected payment (resubmission after the
        // landlord rejected the previous attempt). Pending and Confirmed are
        // both 409 — the tenant cannot re-submit while a previous attempt is
        // awaiting landlord review, and Confirmed is terminal.
        if (payment.Status != PaymentStatus.Outstanding && payment.Status != PaymentStatus.Rejected)
            throw new ConflictException($"Payment is in state {payment.Status} and cannot be submitted.");

        // M3.9 file handling. Validation has already enforced
        // (Method == ReceiptUpload) ⇒ all four file fields non-null, and
        // (Method == ManualRequest) ⇒ all four file fields null. Both
        // misuses surface as 400 ValidationProblemDetails before reaching here.
        string? receiptFileKey = null;
        string? receiptFileName = null;
        string? receiptContentType = null;
        long? receiptSizeBytes = null;

        if (cmd.Method == PaymentMethod.ReceiptUpload)
        {
            // Validator guarantees these are non-null when Method == ReceiptUpload.
            receiptFileKey = await fileStorage.UploadAsync(
                cmd.FileStream!, cmd.FileName!, cmd.ContentType!, ct);
            receiptFileName = cmd.FileName;
            receiptContentType = cmd.ContentType;
            receiptSizeBytes = cmd.FileSizeBytes;
        }

        var now = DateTime.UtcNow;

        payment.Status = PaymentStatus.Pending;
        payment.Method = cmd.Method;
        payment.SubmittedAt = now;
        payment.Notes = cmd.Notes;

        payment.ReceiptFileKey = receiptFileKey;
        payment.ReceiptFileName = receiptFileName;
        payment.ReceiptContentType = receiptContentType;
        payment.ReceiptSizeBytes = receiptSizeBytes;

        // Clear residue from any previous rejection — the tenant has now resubmitted,
        // so the "your last submission was rejected because X" banner should disappear.
        payment.RejectedAt = null;
        payment.RejectionReason = null;

        await paymentRepo.SaveChangesAsync(ct);

        // Submitting a payment shifts the landlord's pending counter (Outstanding
        // → Pending; see M3.5 cached aggregate `landlord:{id}:dashboard`); drop
        // the cached dashboard so the next read repopulates from the DB.
        await dashboardCache.InvalidateAsync(payment.Lease!.LandlordId, ct);

        await events.PublishAsync(
            new PaymentSubmittedEvent(
                payment.Id,
                payment.LeaseId,
                payment.Lease!.TenantId,
                payment.Lease.LandlordId,
                payment.Amount,
                payment.Currency,
                now,
                receiptFileKey),
            ct);

        return new PaymentSubmittedDto(payment.Id, now);
    }
}
