namespace MyProperty.Application.Leases.Commands.CancelOwnLease;

/// <summary>
/// Cancels the authenticated tenant's own active lease. The tenant is resolved
/// from the auth context, so the command carries no fields.
/// </summary>
public sealed record CancelOwnLeaseCommand;
