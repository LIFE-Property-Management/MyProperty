using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MyProperty.Domain.Entities;

namespace MyProperty.Infrastructure.Persistence.Configurations;

internal sealed class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("payments");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Amount).HasPrecision(12, 2);
        builder.Property(p => p.Currency).HasMaxLength(3).IsFixedLength().IsRequired();
        builder.Property(p => p.Status).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(p => p.Method).HasConversion<string>().HasMaxLength(16);
        builder.Property(p => p.RejectionReason).HasMaxLength(500);
        builder.Property(p => p.ReceiptFileKey).HasMaxLength(512);
        builder.Property(p => p.ReceiptFileName).HasMaxLength(256);
        builder.Property(p => p.ReceiptContentType).HasMaxLength(128);
        builder.Property(p => p.Notes).HasMaxLength(500);

        builder.HasOne(p => p.Lease)
            .WithMany(l => l.Payments)
            .HasForeignKey(p => p.LeaseId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(p => new { p.LeaseId, p.Status });

        // Partial index sized to the recurring "mark overdue" Hangfire job's
        // filter. ~74% of payment rows match `DueDate < today`, so an
        // unfiltered b-tree on DueDate hurts the job (the planner walks the
        // full date range and discards rows by Status). A partial index
        // scoped to Outstanding/non-deleted rows is ~4% the size and lets
        // the job answer from the index alone. See
        // docs/performance/m3-sql-optimization/README.md (Q2).
        builder.HasIndex(p => p.DueDate)
            .HasDatabaseName("IX_payments_DueDate_Outstanding")
            .HasFilter("\"Status\" = 'Outstanding' AND \"DeletedAt\" IS NULL");
    }
}
