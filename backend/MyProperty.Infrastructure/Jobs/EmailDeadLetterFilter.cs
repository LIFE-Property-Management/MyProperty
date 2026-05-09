using Hangfire.Common;
using Hangfire.States;
using Hangfire.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using MyProperty.Application.Common.Email;
using MyProperty.Domain.Entities;
using MyProperty.Infrastructure.Persistence;

namespace MyProperty.Infrastructure.Jobs;

/// <summary>
/// Hangfire job filter that watches for <see cref="SendEmailJob"/> invocations
/// transitioning into <see cref="FailedState"/> and persists a dead-letter row
/// to <c>failed_emails</c>. By the time a job reaches <c>FailedState</c> the
/// <c>[AutomaticRetry]</c> filter has already exhausted every retry attempt,
/// so this is the terminal step in the email pipeline.
/// </summary>
public sealed class EmailDeadLetterFilter(
    IServiceScopeFactory scopeFactory,
    ILogger<EmailDeadLetterFilter> logger) : JobFilterAttribute, IApplyStateFilter
{
    public void OnStateApplied(ApplyStateContext context, IWriteOnlyTransaction transaction)
    {
        if (context.NewState is not FailedState failedState) return;
        if (context.BackgroundJob.Job?.Type != typeof(SendEmailJob)) return;

        var message = context.BackgroundJob.Job.Args
            .OfType<EmailMessage>()
            .FirstOrDefault();

        if (message is null)
        {
            logger.LogWarning(
                "SendEmailJob {JobId} entered FailedState but no EmailMessage argument was found.",
                context.BackgroundJob.Id);
            return;
        }

        var attemptCount = context.GetJobParameter<int>("RetryCount") + 1;

        try
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var time = scope.ServiceProvider.GetRequiredService<TimeProvider>();

            db.FailedEmails.Add(new FailedEmail
            {
                ToAddress = message.To,
                Subject = message.Subject,
                Body = message.Body,
                IsHtml = message.IsHtml,
                HangfireJobId = context.BackgroundJob.Id,
                AttemptCount = attemptCount,
                LastError = failedState.Exception?.ToString() ?? failedState.Reason ?? "(unknown)",
                FailedAt = time.GetUtcNow().UtcDateTime,
            });

            db.SaveChanges();

            logger.LogError(
                "Email job {JobId} dead-lettered after {Attempts} attempts. Recipient: {Recipient}.",
                context.BackgroundJob.Id, attemptCount, message.To);
        }
        catch (DbUpdateException ex)
        {
            logger.LogCritical(
                ex,
                "Failed to write dead-letter row for email job {JobId}. Hangfire history is now the only record.",
                context.BackgroundJob.Id);
        }
    }

    public void OnStateUnapplied(ApplyStateContext context, IWriteOnlyTransaction transaction)
    {
    }
}
