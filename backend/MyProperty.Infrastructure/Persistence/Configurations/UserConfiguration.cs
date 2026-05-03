using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MyProperty.Domain.Entities;

namespace MyProperty.Infrastructure.Persistence.Configurations;

internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");

        builder.HasKey(u => u.Id);

        builder.Property(u => u.KeycloakSubId).HasMaxLength(64).IsRequired();
        builder.Property(u => u.Email).HasMaxLength(256).IsRequired();
        builder.Property(u => u.FirstName).HasMaxLength(128).IsRequired();
        builder.Property(u => u.LastName).HasMaxLength(128).IsRequired();
        builder.Property(u => u.Phone).HasMaxLength(32);
        builder.Property(u => u.AccountStatus).HasConversion<string>().HasMaxLength(16);

        builder.HasIndex(u => u.KeycloakSubId).IsUnique();
        builder.HasIndex(u => u.Email).IsUnique();
    }
}
