using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MyProperty.Domain.Entities;

namespace MyProperty.Infrastructure.Persistence.Configurations;

internal sealed class FailedEmailConfiguration : IEntityTypeConfiguration<FailedEmail>
{
    public void Configure(EntityTypeBuilder<FailedEmail> builder)
    {
        builder.ToTable("failed_emails");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.ToAddress).HasMaxLength(256).IsRequired();
        builder.Property(e => e.Subject).HasMaxLength(512).IsRequired();
        builder.Property(e => e.Body).IsRequired();
        builder.Property(e => e.IsHtml).IsRequired();

        builder.Property(e => e.HangfireJobId).HasMaxLength(64).IsRequired();
        builder.Property(e => e.AttemptCount).IsRequired();
        builder.Property(e => e.LastError).IsRequired();
        builder.Property(e => e.FailedAt).IsRequired();

        builder.HasIndex(e => e.FailedAt);
        builder.HasIndex(e => e.HangfireJobId);
    }
}
