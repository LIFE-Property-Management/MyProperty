using MyProperty.Application.Common.Email;

namespace MyProperty.Application.Common.Interfaces;

/// <summary>
/// Application-layer abstraction over the background job runner. Handlers
/// depend on this rather than Hangfire directly so the Application project
/// stays free of infrastructure references.
/// </summary>
public interface IBackgroundJobQueue
{
    /// <summary>
    /// Enqueue a transactional email for asynchronous delivery. Returns the
    /// job id assigned by the runner, useful for correlation and logs.
    /// </summary>
    string EnqueueEmail(EmailMessage message);
}
