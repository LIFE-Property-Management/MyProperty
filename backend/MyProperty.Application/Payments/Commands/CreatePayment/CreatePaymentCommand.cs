namespace MyProperty.Application.Payments.Commands.CreatePayment;

/// <summary>
/// Landlord-initiated creation of an Outstanding payment row against an existing lease.
/// </summary>
/// <remarks>
/// In the long run, payment rows will be auto-generated on a recurring schedule
/// (post-M3 follow-up). For M3 this command exists so landlords can manually
/// create payments for testing and edge-case exploration.
/// </remarks>
public sealed record CreatePaymentCommand(
    Guid LeaseId,
    decimal Amount,
    string Currency,
    DateOnly DueDate);

// Co-located: returned by the handler.
public sealed record PaymentCreatedDto(Guid PaymentId);
