namespace MyProperty.Application.Common.Notifications;

/// <summary>
/// Server-to-client payload for the SignalR <c>PaymentSubmitted</c> event,
/// pushed to the landlord whose tenant just submitted a payment for review.
/// </summary>
/// <remarks>
/// Slightly fatter than the tenant-facing payloads because the landlord
/// dashboard shows a summary card on submission — amount + tenant id are enough
/// for an at-a-glance toast without a refetch of the full payment row.
/// </remarks>
public sealed record PaymentSubmittedNotification(
    Guid PaymentId,
    Guid TenantId,
    Guid LeaseId,
    decimal Amount,
    string Currency,
    DateTime SubmittedAt);
