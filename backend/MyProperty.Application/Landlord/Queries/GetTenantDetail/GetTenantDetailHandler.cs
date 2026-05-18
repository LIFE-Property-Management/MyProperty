using FluentValidation;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Validation;

namespace MyProperty.Application.Landlord.Queries.GetTenantDetail;

public sealed class GetTenantDetailHandler(
    IValidator<GetTenantDetailQuery> validator,
    ILeaseRepository leases,
    IUserRepository users,
    ICurrentUser currentUser)
{
    public async Task<TenantDetailDto> Handle(GetTenantDetailQuery query, CancellationToken ct)
    {
        await validator.EnsureValidAsync(query, ct);
        
        var landlord = await users.GetOrSyncFromClaimsAsync(currentUser.Principal!, ct);


        var lease = await leases.GetLeaseWithPaymentsByTenantAndLandlordAsync(
            query.TenantId, landlord.Id, ct)
            ?? throw new NotFoundException("Tenant lease", query.TenantId);

        var payments = lease.Payments
            .OrderByDescending(p => p.DueDate)
            .Select(p => new PaymentHistoryDto(
                p.Id,
                p.Amount,
                p.Currency,
                p.DueDate,
                p.Status,
                p.SubmittedAt,
                p.ConfirmedAt,
                p.RejectedAt))
            .ToList();

        return new TenantDetailDto(
            lease.TenantId,
            lease.Tenant!.Email,
            $"{lease.Tenant.FirstName} {lease.Tenant.LastName}",
            lease.Property!.Name,
            lease.Id,
            lease.StartDate,
            lease.EndDate,
            lease.MonthlyRent,
            lease.Currency,
            lease.Status,
            payments);
    }
}
