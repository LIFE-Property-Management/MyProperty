namespace MyProperty.Application.Payments.Commands.ConfirmPayment;

/// <summary>
/// Landlord-initiated confirmation of a Pending payment.
/// Transitions <c>Status: Pending → Confirmed</c>.
/// Confirmed is terminal — no further state transitions are valid on this payment.
/// </summary>
public sealed record ConfirmPaymentCommand(Guid PaymentId);

// Co-located: returned by the handler.
public sealed record PaymentConfirmedDto(Guid PaymentId, DateTime ConfirmedAt);
