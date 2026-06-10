using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MyProperty.Domain.Entities;

namespace MyProperty.Infrastructure.Persistence.Configurations;

internal sealed class LeaseConfiguration : IEntityTypeConfiguration<Lease>
{
    public void Configure(EntityTypeBuilder<Lease> builder)
    {
        builder.ToTable("leases");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.MonthlyRent).HasPrecision(12, 2);
        builder.Property(l => l.Currency).HasMaxLength(3).IsFixedLength().IsRequired();
        builder.Property(l => l.Status).HasConversion<string>().HasMaxLength(16).IsRequired();

        builder.HasOne(l => l.Landlord)
            .WithMany()
            .HasForeignKey(l => l.LandlordId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(l => l.Property)
            .WithMany(p => p.Leases)
            .HasForeignKey(l => l.PropertyId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(l => l.Tenant)
            .WithMany(u => u.Leases)
            .HasForeignKey(l => l.TenantId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(l => new { l.LandlordId, l.Status });
        builder.HasIndex(l => new { l.TenantId, l.Status });
        builder.HasIndex(l => new { l.PropertyId, l.Status });
        builder.HasIndex(l => l.EndDate);

        // Single-active-lease-per-property invariant. Partial unique index: a
        // property can have at most one Active, non-soft-deleted lease at a time
        // (Terminated/Expired leases don't count, so re-letting a vacated property
        // works). Backs the application-level guard in the invite-accept handlers
        // against the accept/accept race. Status is stored as the string "Active".
        builder.HasIndex(l => l.PropertyId)
            .IsUnique()
            .HasFilter("\"Status\" = 'Active' AND \"DeletedAt\" IS NULL");

        // Stakeholder dashboard: system-wide active-lease/occupancy counts
        // (Status) and the lease-growth trend (CreatedAt month buckets).
        builder.HasIndex(l => l.Status);
        builder.HasIndex(l => l.CreatedAt);
    }
}
