using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MyProperty.Domain.Entities;

namespace MyProperty.Infrastructure.Persistence.Configurations;

internal sealed class InviteConfiguration : IEntityTypeConfiguration<Invite>
{
    public void Configure(EntityTypeBuilder<Invite> builder)
    {
        builder.ToTable("invites");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.Email).HasMaxLength(256).IsRequired();
        builder.Property(i => i.FirstName).HasMaxLength(128).IsRequired();
        builder.Property(i => i.LastName).HasMaxLength(128).IsRequired();
        builder.Property(i => i.Token).HasMaxLength(128).IsRequired();
        builder.Property(i => i.Status).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(i => i.Currency).HasMaxLength(3).IsFixedLength().IsRequired();
        builder.Property(i => i.ProposedMonthlyRent).HasPrecision(12, 2);

        builder.HasOne(i => i.Landlord)
            .WithMany(u => u.SentInvites)
            .HasForeignKey(i => i.LandlordId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(i => i.Property)
            .WithMany(p => p.Invites)
            .HasForeignKey(i => i.PropertyId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(i => i.Token).IsUnique();
        builder.HasIndex(i => i.ExpiresAt);
        builder.HasIndex(i => new { i.LandlordId, i.Status });
    }
}
