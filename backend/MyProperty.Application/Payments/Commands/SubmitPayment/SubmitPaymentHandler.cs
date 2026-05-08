using FluentValidation;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;
using MyProperty.Application.Payments.Events;
using MyProperty.Domain.Enums;

namespace MyProperty.Application.Payments.Commands.SubmitPayment;

public sealed class SubmitPaymentHandler(
    IValidator<SubmitPaymentCommand> validator,
    ICurrentUser currentUser,
    IUserRepository userRepo,
    IPaymentRepository paymentRepo,
    ILandlordDashboardCache dashboardCache,
    IEventPublisher publisher)
{
    public async Task<PaymentSubmittedDto> Handle(SubmitPaymentCommand cmd, CancellationToken ct)
    {
        await validator.EnsureValidAsync(cmd, ct);

        // Resource-scoped authorization: tenant must own the lease this payment is on.
        // TODO post-M3: extract KeycloakSubId → User lookup into ICurrentUserContext.
        if (currentUser.KeycloakSubId is null)
            throw new ForbiddenException("Authentication required.");

        var tenant = await userRepo.GetByKeycloakSubIdAsync(currentUser.KeycloakSubId, ct)
            ?? throw new ForbiddenException("Authenticated user not found in user table.");

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

        // TODO M3.9: receipt file handling.
        // When Method == ReceiptUpload, this handler currently persists no file.
        // M3.9 batch must:
        //   - Accept IFormFile on the command (or split into AttachReceipt).
        //   - Validate MIME (image/jpeg, image/png, application/pdf) and size (5MB max).
        //   - Persist via IFileStorage.UploadAsync, store the returned key in ReceiptFileKey.
        //   - Store the original filename in ReceiptFileName.
        //   - Reject ReceiptUpload submissions that arrive with no file.
        // See docs/portals.md "Payment submission methods".

        var now = DateTime.UtcNow;

        payment.Status = PaymentStatus.Pending;
        payment.Method = cmd.Method;
        payment.SubmittedAt = now;
        payment.Notes = cmd.Notes;

        // Clear residue from any previous rejection — the tenant has now resubmitted,
        // so the "your last submission was rejected because X" banner should disappear.
        payment.RejectedAt = null;
        payment.RejectionReason = null;

        await paymentRepo.SaveChangesAsync(ct);

        // Submitting a payment shifts the landlord's pending counter (Outstanding
        // → Pending; see M3.5 cached aggregate `landlord:{id}:dashboard`); drop
        // the cached dashboard so the next read repopulates from the DB.
        await dashboardCache.InvalidateAsync(payment.Lease!.LandlordId, ct);

        await publisher.PublishAsync(
            new PaymentSubmittedEvent(
                payment.Id, payment.LeaseId, payment.Lease!.TenantId,
                payment.Lease.LandlordId, payment.Amount, payment.Currency, now),
            ct);

        return new PaymentSubmittedDto(payment.Id, now);
    }
}
