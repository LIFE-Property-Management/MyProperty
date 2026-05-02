using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MyProperty.Infrastructure.Persistence;
using MyProperty.Infrastructure.Persistence.Interceptors;

namespace MyProperty.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton(TimeProvider.System);

        services.AddScoped<AuditingInterceptor>();

        services.AddDbContext<AppDbContext>((sp, options) =>
        {
            var connectionString = configuration.GetConnectionString("Postgres")
                ?? throw new InvalidOperationException(
                    "Missing 'Postgres' connection string in configuration.");

            options.UseNpgsql(connectionString, npgsql => npgsql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName));
            options.AddInterceptors(sp.GetRequiredService<AuditingInterceptor>());
        });

        return services;
    }
}
