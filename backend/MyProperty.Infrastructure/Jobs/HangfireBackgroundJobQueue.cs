using Hangfire;
using MyProperty.Application.Common.Email;
using MyProperty.Application.Common.Interfaces;

namespace MyProperty.Infrastructure.Jobs;

public sealed class HangfireBackgroundJobQueue(IBackgroundJobClient client) : IBackgroundJobQueue
{
    public string EnqueueEmail(EmailMessage message)
        => client.Enqueue<SendEmailJob>(job => job.ExecuteAsync(message, CancellationToken.None));

    public string EnqueueReceiptOcr(Guid paymentId)
        => client.Enqueue<ReceiptOcrJob>(job => job.ExecuteAsync(paymentId, CancellationToken.None));
}
