namespace MyProperty.Application.Common.Email;

/// <summary>
/// Abstraction over the SMTP transport. The infrastructure layer implements
/// this with MailKit; tests substitute fakes. Throws on transient failures so
/// the calling background job can be retried by Hangfire.
/// </summary>
public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken);
}
