using FluentValidation;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Messaging;
using MyProperty.Application.Common.Validation;
using MyProperty.Application.Payments.Events;
using MyProperty.Domain.Enums;

namespace MyProperty.Application.Payments.Commands.RejectPayment;

public sealed class RejectPaymentHandler(
    IValidator<RejectPaymentCommand> validator,
    ICurrentUserContext currentUserContext,
    IPaymentRepository paymentRepo,
    ILandlordDashboardCache dashboardCache,
    IEventPublisher events)
{
    public async Task<PaymentRejectedDto> Handle(RejectPaymentCommand cmd, CancellationToken ct)
    {
        await validator.EnsureValidAsync(cmd, ct);

        // Resource-scoped authorization: landlord must own the lease this payment is on.
        var landlord = await currentUserContext.GetUserAsync(ct);

        var payment = await paymentRepo.GetByIdWithLeaseAsync(cmd.PaymentId, ct)
            ?? throw new NotFoundException("Payment", cmd.PaymentId);

        if (payment.Lease!.LandlordId != landlord.Id)
            throw new ForbiddenException("You do not own this payment.");

        // State machine guard: only Pending payments can be rejected.
        // Rejecting an Outstanding/Confirmed/Rejected row is a 409.
        // The row stays in Rejected until the tenant resubmits — see
        // SubmitPaymentHandler, whose state guard accepts both Outstanding
        // and Rejected and clears RejectionReason/RejectedAt on entry to Pending.
        if (payment.Status != PaymentStatus.Pending)
            throw new ConflictException($"Payment is in state {payment.Status} and cannot be rejected.");

        var now = DateTime.UtcNow;

        payment.Status = PaymentStatus.Rejected;
        payment.RejectedAt = now;
        payment.RejectionReason = cmd.Reason.Trim();

        await paymentRepo.SaveChangesAsync(ct);

        // Rejecting a payment shifts the landlord's pending counters
        // (see M3.5 cached aggregate `landlord:{id}:dashboard`); drop the cached
        // dashboard so the next read repopulates from the DB.
        await dashboardCache.InvalidateAsync(payment.Lease.LandlordId, ct);

        await events.PublishAsync(
            new PaymentRejectedEvent(
                payment.Id,
                payment.LeaseId,
                payment.Lease!.TenantId,
                payment.Lease.LandlordId,
                payment.Amount,
                payment.Currency,
                payment.RejectionReason!,
                now),
            ct);

        return new PaymentRejectedDto(payment.Id, now);
    }
}
