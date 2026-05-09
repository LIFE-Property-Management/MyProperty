namespace MyProperty.Application.Common.Notifications;

/// <summary>
/// Server-to-client payload for the SignalR <c>PaymentRejected</c> event,
/// pushed to the tenant whose payment was just rejected by their landlord.
/// </summary>
/// <remarks>
/// The reason is included so the tenant portal can render the rejection banner
/// without an extra REST round-trip. All other state (amount, due date, etc.)
/// is fetched from the API once the frontend invalidates its query cache.
/// </remarks>
public sealed record PaymentRejectedNotification(
    Guid PaymentId,
    string Reason,
    DateTime RejectedAt);
