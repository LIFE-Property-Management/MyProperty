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
    IPaymentRepository paymentRepo)
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

        // State machine guard: only Outstanding payments can be submitted.
        // Resubmission after rejection works because RejectPaymentHandler loops
        // the row back to Outstanding (see Reject handler in Batch P2).
        if (payment.Status != PaymentStatus.Outstanding)
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

        // TODO M3.8: publish via IEventPublisher when wired up.
        // Event shape:
        //   new PaymentSubmittedEvent(
        //       payment.Id, payment.LeaseId, payment.Lease!.TenantId,
        //       payment.Lease.LandlordId, payment.Amount, payment.Currency, now);
        // M3.6 SignalR consumer pushes this to landlord:{LandlordId}.
        // M3.10 OCR consumer also subscribes (only PaymentId matters for OCR).
        _ = typeof(PaymentSubmittedEvent); // keep the using directive live until M3.8 wires it.

        return new PaymentSubmittedDto(payment.Id, now);
    }
}
