using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using MyProperty.Application.Common.Email;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Notifications;
using MyProperty.Domain.Entities;
using MyProperty.Infrastructure.Jobs;

namespace MyProperty.Tests.Unit.Jobs;

public sealed class LeaseExpiringSoonJobTests
{
    // Fixed "now" so milestone math (EndDate − today) is deterministic, independent of
    // when the suite runs (no midnight-boundary flakiness).
    private static readonly DateTimeOffset Now = new(2026, 6, 1, 8, 0, 0, TimeSpan.Zero);
    private static DateOnly Today => DateOnly.FromDateTime(Now.UtcDateTime);

    private readonly Mock<ILeaseRepository> _leases = new(MockBehavior.Strict);
    private readonly Mock<IBackgroundJobQueue> _jobs = new(MockBehavior.Strict);
    private readonly Mock<INotificationDispatcher> _dispatcher = new(MockBehavior.Strict);

    private LeaseExpiringSoonJob BuildSut() =>
        new(_leases.Object, _jobs.Object, _dispatcher.Object, new FixedClock(Now),
            NullLogger<LeaseExpiringSoonJob>.Instance);

    private static Lease SeedLease(DateOnly endDate, string tag = "a")
    {
        var tenantId = Guid.NewGuid();
        var landlordId = Guid.NewGuid();
        var propertyId = Guid.NewGuid();
        return new Lease
        {
            Id = Guid.NewGuid(),
            LandlordId = landlordId,
            Landlord = new User
            {
                Id = landlordId,
                KeycloakSubId = $"kc-landlord-{tag}",
                Email = $"landlord-{tag}@example.com",
                FirstName = "Lola",
                LastName = "Landlord",
            },
            PropertyId = propertyId,
            Property = new Property
            {
                Id = propertyId,
                LandlordId = landlordId,
                Name = "Maple Court",
                Address = "1 Maple St",
            },
            TenantId = tenantId,
            Tenant = new User
            {
                Id = tenantId,
                KeycloakSubId = $"kc-tenant-{tag}",
                Email = $"tenant-{tag}@example.com",
                FirstName = "Tom",
                LastName = "Tenant",
            },
            StartDate = endDate.AddYears(-1),
            EndDate = endDate,
            MonthlyRent = 800m,
            Currency = "EUR",
        };
    }

    [Fact]
    public async Task Does_nothing_when_no_leases_are_expiring()
    {
        _leases.Setup(r => r.ListAllExpiringSoonAsync(It.IsAny<DateOnly>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
               .ReturnsAsync([]);

        await BuildSut().ExecuteAsync(CancellationToken.None);

        _jobs.Verify(j => j.EnqueueEmail(It.IsAny<EmailMessage>()), Times.Never);
        VerifyNoDispatch();
    }

    [Fact]
    public async Task Queries_the_repository_with_the_30_day_window()
    {
        int captured = -1;
        _leases.Setup(r => r.ListAllExpiringSoonAsync(It.IsAny<DateOnly>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
               .Callback<DateOnly, int, CancellationToken>((_, days, _) => captured = days)
               .ReturnsAsync([]);

        await BuildSut().ExecuteAsync(CancellationToken.None);

        Assert.Equal(30, captured);
    }

    [Fact]
    public async Task Emails_and_pushes_both_parties_for_a_milestone_lease()
    {
        var lease = SeedLease(Today.AddDays(7));   // 7 days out → a milestone
        _leases.Setup(r => r.ListAllExpiringSoonAsync(It.IsAny<DateOnly>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
               .ReturnsAsync([lease]);

        var emails = new List<EmailMessage>();
        _jobs.Setup(j => j.EnqueueEmail(It.IsAny<EmailMessage>()))
             .Callback<EmailMessage>(emails.Add)
             .Returns("job-id");
        _dispatcher.Setup(d => d.NotifyTenantLeaseExpiringAsync(
                lease.TenantId, It.IsAny<LeaseExpiringNotification>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _dispatcher.Setup(d => d.NotifyLandlordLeaseExpiringAsync(
                lease.LandlordId, It.IsAny<LeaseExpiringNotification>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        await BuildSut().ExecuteAsync(CancellationToken.None);

        // One durable email to each party.
        Assert.Equal(2, emails.Count);
        Assert.Contains(emails, e => e.To.StartsWith("tenant"));
        Assert.Contains(emails, e => e.To.StartsWith("landlord"));

        // Plus a SignalR push to each, carrying the enriched payload.
        _dispatcher.Verify(d => d.NotifyTenantLeaseExpiringAsync(
                lease.TenantId,
                It.Is<LeaseExpiringNotification>(n =>
                    n.LeaseId == lease.Id && n.TenantId == lease.TenantId
                    && n.PropertyId == lease.PropertyId && n.ExpiresAt == lease.EndDate),
                It.IsAny<CancellationToken>()),
            Times.Once);
        _dispatcher.Verify(d => d.NotifyLandlordLeaseExpiringAsync(
                lease.LandlordId, It.IsAny<LeaseExpiringNotification>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Skips_a_lease_that_is_not_on_a_milestone_day()
    {
        var lease = SeedLease(Today.AddDays(10));  // 10 days out → not a milestone
        _leases.Setup(r => r.ListAllExpiringSoonAsync(It.IsAny<DateOnly>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
               .ReturnsAsync([lease]);

        await BuildSut().ExecuteAsync(CancellationToken.None);

        _jobs.Verify(j => j.EnqueueEmail(It.IsAny<EmailMessage>()), Times.Never);
        VerifyNoDispatch();
    }

    [Fact]
    public async Task A_failure_on_one_lease_does_not_block_the_others()
    {
        var bad = SeedLease(Today.AddDays(7), "bad");
        var good = SeedLease(Today.AddDays(7), "good");
        _leases.Setup(r => r.ListAllExpiringSoonAsync(It.IsAny<DateOnly>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
               .ReturnsAsync([bad, good]);

        // The bad lease's first email enqueue throws; the good lease must still be processed.
        _jobs.Setup(j => j.EnqueueEmail(It.Is<EmailMessage>(e => e.To.Contains("bad"))))
             .Throws(new InvalidOperationException("queue down"));
        var goodEmails = new List<EmailMessage>();
        _jobs.Setup(j => j.EnqueueEmail(It.Is<EmailMessage>(e => e.To.Contains("good"))))
             .Callback<EmailMessage>(goodEmails.Add)
             .Returns("job-id");
        _dispatcher.Setup(d => d.NotifyTenantLeaseExpiringAsync(
                good.TenantId, It.IsAny<LeaseExpiringNotification>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _dispatcher.Setup(d => d.NotifyLandlordLeaseExpiringAsync(
                good.LandlordId, It.IsAny<LeaseExpiringNotification>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        await BuildSut().ExecuteAsync(CancellationToken.None);

        Assert.Equal(2, goodEmails.Count);   // good lease got both its emails
        _dispatcher.Verify(d => d.NotifyTenantLeaseExpiringAsync(
                good.TenantId, It.IsAny<LeaseExpiringNotification>(), It.IsAny<CancellationToken>()),
            Times.Once);
        _dispatcher.Verify(d => d.NotifyLandlordLeaseExpiringAsync(
                good.LandlordId, It.IsAny<LeaseExpiringNotification>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task A_failed_tenant_email_does_not_suppress_the_landlord_email_or_the_pushes()
    {
        var lease = SeedLease(Today.AddDays(7));   // 7 days out → a milestone
        _leases.Setup(r => r.ListAllExpiringSoonAsync(It.IsAny<DateOnly>(), It.IsAny<int>(), It.IsAny<CancellationToken>()))
               .ReturnsAsync([lease]);

        // The tenant email enqueue throws; the landlord email (a separate durable
        // delivery) must still be enqueued, and both best-effort pushes must still fire.
        _jobs.Setup(j => j.EnqueueEmail(It.Is<EmailMessage>(e => e.To.StartsWith("tenant"))))
             .Throws(new InvalidOperationException("queue down"));
        var landlordEmails = new List<EmailMessage>();
        _jobs.Setup(j => j.EnqueueEmail(It.Is<EmailMessage>(e => e.To.StartsWith("landlord"))))
             .Callback<EmailMessage>(landlordEmails.Add)
             .Returns("job-id");
        _dispatcher.Setup(d => d.NotifyTenantLeaseExpiringAsync(
                lease.TenantId, It.IsAny<LeaseExpiringNotification>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _dispatcher.Setup(d => d.NotifyLandlordLeaseExpiringAsync(
                lease.LandlordId, It.IsAny<LeaseExpiringNotification>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        await BuildSut().ExecuteAsync(CancellationToken.None);

        Assert.Single(landlordEmails);   // landlord email enqueued despite the tenant failure
        _dispatcher.Verify(d => d.NotifyTenantLeaseExpiringAsync(
                lease.TenantId, It.IsAny<LeaseExpiringNotification>(), It.IsAny<CancellationToken>()),
            Times.Once);
        _dispatcher.Verify(d => d.NotifyLandlordLeaseExpiringAsync(
                lease.LandlordId, It.IsAny<LeaseExpiringNotification>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    private void VerifyNoDispatch()
    {
        _dispatcher.Verify(d => d.NotifyTenantLeaseExpiringAsync(
                It.IsAny<Guid>(), It.IsAny<LeaseExpiringNotification>(), It.IsAny<CancellationToken>()),
            Times.Never);
        _dispatcher.Verify(d => d.NotifyLandlordLeaseExpiringAsync(
                It.IsAny<Guid>(), It.IsAny<LeaseExpiringNotification>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
