using Hangfire;
using Microsoft.Extensions.Logging;
using MyProperty.Application.Common.Email;

namespace MyProperty.Infrastructure.Jobs;

/// <summary>
/// Hangfire-invoked job that delivers a single transactional email. Hangfire
/// serializes the <see cref="EmailMessage"/> argument and persists it in
/// PostgreSQL, so a server crash mid-send never loses the message.
/// </summary>
/// <remarks>
/// On any thrown exception Hangfire automatically retries up to 5 additional
/// times with exponentially-increasing delays (30s, 2m, 10m, 30m, 1h). After
/// the final attempt fails the job transitions to <c>FailedState</c>, which
/// <see cref="EmailDeadLetterFilter"/> intercepts to persist a
/// <c>failed_emails</c> dead-letter row for operator review.
/// </remarks>
[AutomaticRetry(
    Attempts = 5,
    DelaysInSeconds = new[] { 30, 120, 600, 1800, 3600 },
    OnAttemptsExceeded = AttemptsExceededAction.Fail)]
public sealed class SendEmailJob(IEmailSender sender, ILogger<SendEmailJob> logger)
{
    [Queue("emails")]
    public async Task ExecuteAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        logger.LogInformation(
            "Dispatching email to {Recipient} subject {Subject}",
            message.To, message.Subject);

        await sender.SendAsync(message, cancellationToken);
    }
}
