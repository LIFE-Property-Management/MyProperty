using FluentValidation;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;
using MyProperty.Application.Payments.Events;
using MyProperty.Domain.Enums;

namespace MyProperty.Application.Payments.Commands.ConfirmPayment;

public sealed class ConfirmPaymentHandler(
    IValidator<ConfirmPaymentCommand> validator,
    ICurrentUser currentUser,
    IUserRepository userRepo,
    IPaymentRepository paymentRepo,
    ILandlordDashboardCache dashboardCache,
    IEventPublisher publisher)
{
    public async Task<PaymentConfirmedDto> Handle(ConfirmPaymentCommand cmd, CancellationToken ct)
    {
        await validator.EnsureValidAsync(cmd, ct);

        // Resource-scoped authorization: landlord must own the lease this payment is on.
        // TODO post-M3: extract KeycloakSubId → User lookup into ICurrentUserContext.
        if (currentUser.KeycloakSubId is null)
            throw new ForbiddenException("Authentication required.");

        var landlord = await userRepo.GetByKeycloakSubIdAsync(currentUser.KeycloakSubId, ct)
            ?? throw new ForbiddenException("Authenticated user not found in user table.");

        var payment = await paymentRepo.GetByIdWithLeaseAsync(cmd.PaymentId, ct)
            ?? throw new NotFoundException("Payment", cmd.PaymentId);

        if (payment.Lease!.LandlordId != landlord.Id)
            throw new ForbiddenException("You do not own this payment.");

        // State machine guard: only Pending payments can be confirmed.
        // Confirmed is terminal — re-confirming a Confirmed row is rejected,
        // confirming an Outstanding/Rejected row is also rejected.
        if (payment.Status != PaymentStatus.Pending)
            throw new ConflictException($"Payment is in state {payment.Status} and cannot be confirmed.");

        var now = DateTime.UtcNow;

        payment.Status = PaymentStatus.Confirmed;
        payment.ConfirmedAt = now;

        await paymentRepo.SaveChangesAsync(ct);

        // Confirming a payment shifts the landlord's pending/overdue counters
        // (see M3.5 cached aggregate `landlord:{id}:dashboard`); drop the cached
        // dashboard so the next read repopulates from the DB.
        await dashboardCache.InvalidateAsync(payment.Lease.LandlordId, ct);

        await publisher.PublishAsync(
            new PaymentConfirmedEvent(
                payment.Id, payment.LeaseId, payment.Lease!.TenantId,
                payment.Lease.LandlordId, payment.Amount, payment.Currency, now),
            ct);

        return new PaymentConfirmedDto(payment.Id, now);
    }
}
