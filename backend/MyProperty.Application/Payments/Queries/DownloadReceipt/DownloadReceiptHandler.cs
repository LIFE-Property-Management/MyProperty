using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;

namespace MyProperty.Application.Payments.Queries.DownloadReceipt;

/// <summary>
/// Streams a payment's attached receipt file to the caller after enforcing
/// lease-scoped authorization.
/// </summary>
/// <remarks>
/// <para>
/// Pattern matches the inline <c>KeycloakSubId → User</c> lookup used by the
/// other payment handlers. The post-M3 <c>ICurrentUserContext</c> extraction
/// will dedupe this — for now we duplicate the pattern to stay consistent.
/// </para>
/// </remarks>
public sealed class DownloadReceiptHandler(
    ICurrentUser currentUser,
    IUserRepository userRepo,
    IPaymentRepository paymentRepo,
    IFileStorage fileStorage)
{
    public async Task<DownloadReceiptResult> Handle(Guid paymentId, CancellationToken ct)
    {
        if (currentUser.KeycloakSubId is null)
            throw new ForbiddenException("Authentication required.");

        var user = await userRepo.GetByKeycloakSubIdAsync(currentUser.KeycloakSubId, ct)
            ?? throw new ForbiddenException("Authenticated user not found in user table.");

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
