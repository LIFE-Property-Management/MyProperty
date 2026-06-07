using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;

namespace MyProperty.Application.Payments.Queries.DownloadReceipt;

/// <summary>
/// Streams a payment's attached receipt file to the caller after enforcing
/// lease-scoped authorization.
/// </summary>
/// <remarks>
/// <para>
/// Resolves the caller to the internal <see cref="MyProperty.Domain.Entities.User"/>
/// via <see cref="ICurrentUserContext"/>, then enforces lease-scoped access
/// (tenant on the payment's lease OR landlord that owns it).
/// </para>
/// </remarks>
public sealed class DownloadReceiptHandler(
    ICurrentUserContext currentUserContext,
    IPaymentRepository paymentRepo,
    IFileStorage fileStorage)
{
    public async Task<DownloadReceiptResult> Handle(Guid paymentId, CancellationToken ct)
    {
        var user = await currentUserContext.GetUserAsync(ct);

        var payment = await paymentRepo.GetByIdWithLeaseAsync(paymentId, ct)
            ?? throw new NotFoundException("Payment", paymentId);

        // Lease-scoped authorization: tenant on this lease OR landlord that owns it.
        var isTenant = payment.Lease!.TenantId == user.Id;
        var isLandlord = payment.Lease!.LandlordId == user.Id;
        if (!isTenant && !isLandlord)
            throw new ForbiddenException("You do not have access to this receipt.");

        if (string.IsNullOrEmpty(payment.ReceiptFileKey))
            throw new NotFoundException("Receipt", paymentId);

        var stream = await fileStorage.DownloadAsync(payment.ReceiptFileKey, ct);

        return new DownloadReceiptResult(
            Content: stream,
            FileName: payment.ReceiptFileName ?? "receipt",
            ContentType: payment.ReceiptContentType ?? "application/octet-stream");
    }
}

public sealed record DownloadReceiptResult(Stream Content, string FileName, string ContentType);
