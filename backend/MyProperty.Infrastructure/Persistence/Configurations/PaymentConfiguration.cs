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
        builder.Property(p => p.Notes).HasMaxLength(500);

        builder.HasOne(p => p.Lease)
            .WithMany(l => l.Payments)
            .HasForeignKey(p => p.LeaseId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(p => new { p.LeaseId, p.Status });
        builder.HasIndex(p => p.DueDate);
    }
}
