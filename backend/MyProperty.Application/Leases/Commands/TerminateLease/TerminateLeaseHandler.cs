using FluentValidation;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;
using MyProperty.Domain.Enums;

namespace MyProperty.Application.Leases.Commands.TerminateLease;

public sealed class TerminateLeaseHandler(
    IValidator<TerminateLeaseCommand> validator,
    ILeaseRepository leases,
    ICurrentUserContext currentUserContext,
    ILandlordDashboardCache dashboardCache)
{
    public async Task Handle(TerminateLeaseCommand cmd, CancellationToken ct)
    {
        await validator.EnsureValidAsync(cmd, ct);

        var landlord = await currentUserContext.GetOrSyncUserAsync(ct);

        var lease = await leases.GetByIdAsync(cmd.LeaseId, ct)
            ?? throw new NotFoundException("Lease", cmd.LeaseId);

        if (lease.LandlordId != landlord.Id)
            throw new ForbiddenException("You do not own this lease.");

        lease.Terminate();
        await leases.SaveChangesAsync(ct);

        await dashboardCache.InvalidateAsync(landlord.Id, ct);
    }
}
