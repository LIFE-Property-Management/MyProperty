using FluentValidation;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;

namespace MyProperty.Application.Leases.Queries.GetLeasesExpiringSoon;

public sealed class GetLeasesExpiringSoonHandler(
    IValidator<GetLeasesExpiringSoonQuery> validator,
    ILeaseRepository leases,
    ICurrentUserContext currentUserContext)
{
    public async Task<IReadOnlyList<ExpiringLeaseDto>> Handle(
        GetLeasesExpiringSoonQuery query, CancellationToken ct)
    {
        await validator.EnsureValidAsync(query, ct);

        var landlord = await currentUserContext.GetOrSyncUserAsync(ct);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var leasesExpiringSoon = await leases.ListExpiringSoonAsync(
            landlord.Id, query.DaysThreshold, ct);

        // Property is always loaded via Include in ListExpiringSoonAsync
        // Tenant is always loaded via Include in ListExpiringSoonAsync
        return leasesExpiringSoon.Select(l => new ExpiringLeaseDto(
            l.Id,
            l.PropertyId,
            l.Property!.Name,
            l.TenantId,
            l.Tenant!.Email,
            l.Tenant.FirstName,
            l.Tenant.LastName,
            l.EndDate,
            l.EndDate.DayNumber - today.DayNumber)).ToList();
    }
}
