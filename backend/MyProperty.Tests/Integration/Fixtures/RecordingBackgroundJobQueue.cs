using System.Collections.Concurrent;
using MyProperty.Application.Common.Email;
using MyProperty.Application.Common.Interfaces;

namespace MyProperty.Tests.Integration.Fixtures;

/// <summary>
/// Test substitute for <see cref="IBackgroundJobQueue"/>: captures every email
/// the production code attempts to enqueue without invoking Hangfire (which
/// would otherwise hit Postgres + an unreachable SMTP server). Tests assert on
/// the recorded payload and extract the plain invite token from the email body.
/// </summary>
internal sealed class RecordingBackgroundJobQueue : IBackgroundJobQueue
{
    private readonly ConcurrentQueue<EmailMessage> _emails = new();

    public IReadOnlyCollection<EmailMessage> Emails => _emails.ToArray();

    public string EnqueueEmail(EmailMessage message)
    {
        _emails.Enqueue(message);
        return Guid.NewGuid().ToString("N");
    }

    public void Clear()
    {
        while (_emails.TryDequeue(out _)) { }
    }
}
