using FluentValidation;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;
using MyProperty.Application.Payments.Events;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;

namespace MyProperty.Application.Payments.Commands.CreatePayment;

public sealed class CreatePaymentHandler(
    IValidator<CreatePaymentCommand> validator,
    ICurrentUser currentUser,
    IUserRepository userRepo,
    ILeaseRepository leaseRepo,
    IPaymentRepository paymentRepo,
    ILandlordDashboardCache dashboardCache)
{
    public async Task<PaymentCreatedDto> Handle(CreatePaymentCommand cmd, CancellationToken ct)
    {
        await validator.EnsureValidAsync(cmd, ct);

        // Resource-scoped authorization: landlord must own the lease.
        // TODO post-M3: extract this lookup pattern (KeycloakSubId → internal User)
        // into ICurrentUserContext to remove the duplication across payment handlers.
        if (currentUser.KeycloakSubId is null)
            throw new ForbiddenException("Authentication required.");

        var landlord = await userRepo.GetByKeycloakSubIdAsync(currentUser.KeycloakSubId, ct)
            ?? throw new ForbiddenException("Authenticated user not found in user table.");

        var lease = await leaseRepo.GetByIdAsync(cmd.LeaseId, ct)
            ?? throw new NotFoundException("Lease", cmd.LeaseId);

        if (lease.LandlordId != landlord.Id)
            throw new ForbiddenException("You do not own this lease.");

        var payment = new Payment
        {
            LeaseId = lease.Id,
            Amount = cmd.Amount,
            Currency = cmd.Currency,
            DueDate = cmd.DueDate,
            Status = PaymentStatus.Outstanding,
        };

        await paymentRepo.AddAsync(payment, ct);
        await paymentRepo.SaveChangesAsync(ct);

        // Creating a new Outstanding payment shifts the landlord's pending/overdue
        // counters (see M3.5 cached aggregate `landlord:{id}:dashboard`); drop the
        // cached dashboard so the next read repopulates from the DB.
        await dashboardCache.InvalidateAsync(lease.LandlordId, ct);

        // TODO M3.8: publish via IEventPublisher when wired up.
        // Event shape:
        //   new PaymentCreatedEvent(
        //       payment.Id, lease.Id, lease.TenantId, lease.LandlordId,
        //       payment.Amount, payment.Currency, payment.DueDate,
        //       payment.CreatedAt);
        // Note: payment.CreatedAt is populated by the audit interceptor during
        // SaveChangesAsync, so it is valid by the time this publish would run.
        // If it ever reads as default(DateTime), the interceptor is not wired
        // for Payment — investigate before publishing.
        // M3.6 SignalR consumer pushes this to tenant:{TenantId}.
        _ = typeof(PaymentCreatedEvent); // keep the using directive live until M3.8 wires it.

        return new PaymentCreatedDto(payment.Id);
    }
}
