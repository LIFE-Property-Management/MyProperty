using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using MyProperty.Application.Common.Email;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Messaging;
using MyProperty.Application.Common.Options;
using MyProperty.Infrastructure.Caching;
using MyProperty.Infrastructure.Email;
using MyProperty.Infrastructure.Jobs;
using MyProperty.Infrastructure.Messaging;
using MyProperty.Infrastructure.Messaging.Consumers;
using MyProperty.Infrastructure.Persistence;
using MyProperty.Infrastructure.Persistence.Interceptors;
using MyProperty.Infrastructure.Persistence.Repositories;

namespace MyProperty.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton(TimeProvider.System);

        services.AddScoped<AuditingInterceptor>();

        var connectionString = configuration.GetConnectionString("Postgres")
            ?? throw new InvalidOperationException(
                "Missing 'Postgres' connection string in configuration.");

        services.AddDbContext<AppDbContext>((sp, options) =>
        {
            options.UseNpgsql(connectionString, npgsql => npgsql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName));
            options.AddInterceptors(sp.GetRequiredService<AuditingInterceptor>());
        });

        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IInviteRepository, InviteRepository>();
        services.AddScoped<ILeaseRepository, LeaseRepository>();
        services.AddScoped<IPropertyRepository, PropertyRepository>();
        services.AddScoped<ILandlordDashboardRepository, LandlordDashboardRepository>();
        services.AddScoped<IPaymentRepository, PaymentRepository>();

        services.AddCaching(configuration);
        services.AddBackgroundJobs(configuration, connectionString);
        services.AddMessaging(configuration);

        return services;
    }

    private static IServiceCollection AddMessaging(
        this IServiceCollection services, IConfiguration configuration)
    {
        var section = configuration.GetSection(RabbitMqOptions.SectionName);
        var enabled = section.GetValue("Enabled", defaultValue: true);

        if (!enabled)
        {
            // Tests (and any environment that explicitly opts out) get the
            // no-op publisher and no consumer. The handler call sites stay
            // identical to production.
            services.AddSingleton<IEventPublisher, NullEventPublisher>();
            return services;
        }

        services.AddOptions<RabbitMqOptions>()
            .Bind(section)
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddSingleton<RabbitMqConnectionProvider>();
        services.AddSingleton<IEventPublisher, RabbitMqEventPublisher>();
        services.AddHostedService<PaymentConfirmedConsumer>();

        return services;
    }

    private static IServiceCollection AddCaching(
        this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<CacheOptions>()
            .Bind(configuration.GetSection(CacheOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        var cacheOptions = configuration.GetSection(CacheOptions.SectionName).Get<CacheOptions>()
            ?? throw new InvalidOperationException(
                $"Missing '{CacheOptions.SectionName}' section in configuration.");

        services.AddStackExchangeRedisCache(options =>
        {
            options.Configuration = cacheOptions.RedisConnection;
            options.InstanceName  = cacheOptions.InstancePrefix;
        });

        services.AddScoped<ILandlordDashboardCache, RedisLandlordDashboardCache>();

        return services;
    }

    private static IServiceCollection AddBackgroundJobs(
        this IServiceCollection services,
        IConfiguration configuration,
        string connectionString)
    {
        services.AddOptions<SmtpOptions>()
            .Bind(configuration.GetSection(SmtpOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddScoped<IEmailSender, MailKitEmailSender>();
        services.AddScoped<SendEmailJob>();
        services.AddSingleton<EmailDeadLetterFilter>();

        services.AddHangfire((sp, config) =>
        {
            config
                .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
                .UseSimpleAssemblyNameTypeSerializer()
                .UseRecommendedSerializerSettings()
                .UsePostgreSqlStorage(opts => opts.UseNpgsqlConnection(connectionString))
                .UseFilter(sp.GetRequiredService<EmailDeadLetterFilter>());
        });

        services.AddHangfireServer(options =>
        {
            options.Queues = new[] { "emails", "default" };
            options.WorkerCount = Environment.ProcessorCount * 2;
        });

        services.AddScoped<IBackgroundJobQueue, HangfireBackgroundJobQueue>();

        return services;
    }
}
