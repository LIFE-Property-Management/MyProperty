using MyProperty.Domain.Common;

namespace MyProperty.Domain.Entities;

/// <summary>
/// Dead-letter record written when a transactional email cannot be delivered
/// after Hangfire has exhausted all automatic retry attempts. Operators inspect
/// this table to diagnose persistent send failures and decide whether to
/// requeue, edit, or discard the message.
/// </summary>
public class FailedEmail : BaseEntity
{
    public required string ToAddress { get; set; }
    public required string Subject { get; set; }
    public required string Body { get; set; }
    public required bool IsHtml { get; set; }

    public required string HangfireJobId { get; set; }
    public required int AttemptCount { get; set; }
    public required string LastError { get; set; }
    public required DateTime FailedAt { get; set; }
}
