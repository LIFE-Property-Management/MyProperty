namespace MyProperty.Application.Leases.Commands.TerminateLease;

public sealed record TerminateLeaseCommand(Guid LeaseId, Guid LandlordId);
