using MyProperty.Application.Common.Interfaces;

namespace MyProperty.Application.Leases.Queries.GetTenantLease;

public sealed class GetTenantLeaseHandler (
    ILeaseRepository leases,
    IUserRepository users,
    ICurrentUser currentUser)
{
    public async Task<TenantLeaseDto?> Handle(GetTenantLeaseQuery query, CancellationToken ct)
    {
        var tenant = await users.GetOrSyncFromClaimsAsync(currentUser.Principal!, ct);
        
        var lease = await leases.GetActiveByTenantIdAsync(tenant.Id, ct);
        if (lease is null)
            return null;

        var landlordName = lease.Landlord is not null
            ? $"{lease.Landlord.FirstName} {lease.Landlord.LastName}"
            : string.Empty;

        // Property is always loaded via Include in GetActiveByTenantIdAsync
        return new TenantLeaseDto(
            lease.Id,
            lease.Property!.Name,
            landlordName,
            lease.StartDate,
            lease.EndDate,
            lease.MonthlyRent,
            lease.Currency,
            lease.Status);
    }
}
