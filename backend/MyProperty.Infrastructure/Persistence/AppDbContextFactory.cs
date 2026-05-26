using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace MyProperty.Infrastructure.Persistence;

internal sealed class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var connectionString =
            Environment.GetEnvironmentVariable("ConnectionStrings__Postgres")
            // Local-dev-only fallback — used by `dotnet ef migrations add` and
            // `dotnet ef database update` on a developer machine. The migration
            // bundle running in CI/CD or K8s MUST set ConnectionStrings__Postgres
            // explicitly; this fallback points at the docker-compose Postgres and
            // is meaningless outside dev.
            ?? "Host=localhost;Port=5432;Database=myproperty;Username=postgres;Password=postgres";

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString,
                npgsql => npgsql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName))
            .Options;

        return new AppDbContext(options);
    }
}
