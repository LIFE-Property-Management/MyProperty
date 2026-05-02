using MyProperty.Domain.Common;
using MyProperty.Domain.Enums;

namespace MyProperty.Domain.Entities;

public class Payment : BaseEntity
{
    public required Guid LeaseId { get; set; }
    public Lease? Lease { get; set; }

    public required decimal Amount { get; set; }
    public required string Currency { get; set; }
    public required DateOnly DueDate { get; set; }
    public required PaymentStatus Status { get; set; } = PaymentStatus.Outstanding;

    public PaymentMethod? Method { get; set; }
    public DateTime? SubmittedAt { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public DateTime? RejectedAt { get; set; }
    public string? RejectionReason { get; set; }

    public string? ReceiptFileKey { get; set; }
    public string? ReceiptFileName { get; set; }

    public string? Notes { get; set; }
}
