namespace MyProperty.Application.Common.Notifications;

/// <summary>
/// Server-to-client payload for the SignalR <c>PaymentCreated</c> event,
/// pushed to the tenant when a landlord creates a new outstanding payment row
/// against their lease.
/// </summary>
/// <remarks>
/// The frontend uses this signal to surface the new outstanding payment in the
/// tenant dashboard without forcing the user to refresh. <see cref="DueDate"/>
/// drives the "due in N days" banner and is included so the toast can render
/// urgency without a second round-trip.
/// </remarks>
public sealed record PaymentCreatedNotification(
    Guid PaymentId,
    decimal Amount,
    string Currency,
    DateOnly DueDate);
