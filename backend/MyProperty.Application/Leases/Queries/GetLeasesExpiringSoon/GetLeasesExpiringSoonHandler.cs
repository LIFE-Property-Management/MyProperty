using FluentValidation;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;

namespace MyProperty.Application.Leases.Queries.GetLeasesExpiringSoon;

public sealed class GetLeasesExpiringSoonHandler(
    IValidator<GetLeasesExpiringSoonQuery> validator,
    ILeaseRepository leaseRepo)
{
    public async Task<IReadOnlyList<ExpiringLeaseDto>> Handle(
        GetLeasesExpiringSoonQuery query, CancellationToken ct)
    {
        await validator.EnsureValidAsync(query, ct);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var leases = await leaseRepo.ListExpiringSoonAsync(
            query.LandlordId, query.DaysThreshold, ct);

        return leases.Select(l => new ExpiringLeaseDto(
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
