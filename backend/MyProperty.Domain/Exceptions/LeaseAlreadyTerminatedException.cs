namespace MyProperty.Domain.Exceptions;

public sealed class LeaseAlreadyTerminatedException(Guid leaseId)
    : Exception($"Lease {leaseId} is already terminated.");