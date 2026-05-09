namespace MyProperty.Application.Common.Email;

/// <summary>
/// Transactional email payload passed across the queue boundary. Hangfire
/// serializes instances of this record as job arguments, so it must remain a
/// plain data shape with no behavior or non-serializable fields.
/// </summary>
public sealed record EmailMessage(
    string To,
    string Subject,
    string Body,
    bool IsHtml = true);
