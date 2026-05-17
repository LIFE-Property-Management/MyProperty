using MyProperty.Application.Common.Interfaces;

namespace MyProperty.Application.Leases.Queries.GetTenantLease;

public sealed class GetTenantLeaseHandler(ILeaseRepository leaseRepo)
{
    public async Task<TenantLeaseDto?> Handle(GetTenantLeaseQuery query, CancellationToken ct)
    {
        var lease = await leaseRepo.GetActiveByTenantIdAsync(query.TenantId, ct);
        if (lease is null)
            return null;

        var landlordName = lease.Landlord is not null
            ? $"{lease.Landlord.FirstName} {lease.Landlord.LastName}"
            : string.Empty;

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
