using FluentValidation;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;
using MyProperty.Domain.Enums;

namespace MyProperty.Application.Leases.Commands.TerminateLease;

public sealed class TerminateLeaseHandler(
    IValidator<TerminateLeaseCommand> validator,
    ILeaseRepository leaseRepo,
    ILandlordDashboardCache dashboardCache)
{
    public async Task Handle(TerminateLeaseCommand cmd, CancellationToken ct)
    {
        await validator.EnsureValidAsync(cmd, ct);

        var lease = await leaseRepo.GetByIdAsync(cmd.LeaseId, ct)
            ?? throw new NotFoundException("Lease", cmd.LeaseId);

        if (lease.LandlordId != cmd.LandlordId)
            throw new ForbiddenException("You do not own this lease.");

        if (lease.Status == LeaseStatus.Terminated)
            throw new ConflictException("Lease is already terminated.");

        lease.Status = LeaseStatus.Terminated;
        await leaseRepo.SaveChangesAsync(ct);

        await dashboardCache.InvalidateAsync(cmd.LandlordId, ct);
    }
}
