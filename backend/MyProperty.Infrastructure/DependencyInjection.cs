using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using MyProperty.Application.Common.Email;
using MyProperty.Application.Common.FeatureFlags;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Messaging;
using MyProperty.Application.Common.Options;
using MyProperty.Infrastructure.Ai;
using MyProperty.Infrastructure.Caching;
using MyProperty.Infrastructure.Email;
using MyProperty.Infrastructure.FeatureFlags;
using MyProperty.Infrastructure.Keycloak;
using MyProperty.Infrastructure.Storage;
using MyProperty.Infrastructure.Jobs;
using MyProperty.Infrastructure.Messaging;
using MyProperty.Infrastructure.Messaging.Consumers;
using MyProperty.Infrastructure.Persistence;
using MyProperty.Infrastructure.Persistence.Interceptors;
using MyProperty.Infrastructure.Persistence.Repositories;
using Unleash;

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
        services.AddStorage(configuration);
        services.AddAiServices(configuration);
        services.AddFeatureFlags(configuration);
        services.AddKeycloakAdmin(configuration);

        return services;
    }

    private static IServiceCollection AddStorage(
        this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<FileStorageOptions>()
            .Bind(configuration.GetSection(FileStorageOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddSingleton<IFileStorage, LocalFileStorage>();

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

        // Each consumer subscribes to a single routing key on the shared
        // myproperty.events exchange. PaymentConfirmed → email + SignalR; the
        // rest → SignalR only (their CLAUDE.md push spec doesn't include a
        // mail leg yet).
        services.AddHostedService<PaymentConfirmedConsumer>();
        services.AddHostedService<PaymentSubmittedConsumer>();
        services.AddHostedService<PaymentSubmittedOcrConsumer>();
        services.AddHostedService<PaymentRejectedConsumer>();
        services.AddHostedService<PaymentCreatedConsumer>();

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
            options.InstanceName = cacheOptions.InstancePrefix;
        });

        services.AddScoped<ILandlordDashboardCache, RedisLandlordDashboardCache>();

        return services;
    }

    private static IServiceCollection AddAiServices(
        this IServiceCollection services, IConfiguration configuration)
    {
        // AnthropicOcrOptions is bound + validated in Program.cs alongside the
        // other options classes (it lives in Application/Common/Options). This
        // method only wires the OCR service and its HttpClient.
        var timeoutSeconds = configuration
            .GetValue<int?>($"{AnthropicOcrOptions.SectionName}:TimeoutSeconds") ?? 30;

        services.AddHttpClient<IReceiptOcrService, AnthropicReceiptOcrService>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(timeoutSeconds);
        });

        return services;
    }

    private static IServiceCollection AddFeatureFlags(
        this IServiceCollection services, IConfiguration configuration)
    {
        var options = configuration.GetSection(UnleashOptions.SectionName).Get<UnleashOptions>();

        // No token configured → register the no-op provider (returns the caller
        // default everywhere) and skip both the live SDK and options validation,
        // which would otherwise spin up a background poller against an
        // unconfigured server / reject the empty ApiUrl that a no-Unleash
        // environment legitimately ships. Mirrors the NullEventPublisher path in
        // AddMessaging, which likewise validates RabbitMqOptions only when enabled.
        if (options is null || string.IsNullOrWhiteSpace(options.ApiToken))
        {
            services.AddSingleton<IFeatureFlags, NullFeatureFlags>();
            return services;
        }

        // Token present → we intend to use Unleash, so now require a well-formed
        // ApiUrl (etc.) and fail fast at startup if it's missing/malformed.
        services.AddOptions<UnleashOptions>()
            .Bind(configuration.GetSection(UnleashOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        // Singleton IUnleash — owns a background fetch + metrics sender and is
        // thread-safe. DI disposes it on shutdown (DefaultUnleash : IDisposable).
        services.AddSingleton<IUnleash>(_ => new DefaultUnleash(new UnleashSettings
        {
            AppName = options.AppName,
            UnleashApi = new Uri(options.ApiUrl),
            FetchTogglesInterval = TimeSpan.FromSeconds(options.FetchTogglesIntervalSeconds),
            CustomHttpHeaders = new Dictionary<string, string>
            {
                ["Authorization"] = options.ApiToken!,
            },
        }));

        services.AddSingleton<IFeatureFlags, UnleashFeatureFlags>();
        return services;
    }

    private static IServiceCollection AddKeycloakAdmin(
        this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<KeycloakAdminOptions>()
            .Bind(configuration.GetSection(KeycloakAdminOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddSingleton<IKeycloakAdminTokenCache, KeycloakAdminTokenCache>();

        services.AddHttpClient<IUserAccountProvisioner, KeycloakAdminClient>()
            .AddStandardResilienceHandler();

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
        services.AddScoped<ReceiptOcrJob>();
        services.AddScoped<MarkExpiredInvitesJob>();
        services.AddScoped<OrphanCleanupJob>();
        services.AddScoped<LeaseExpiringSoonJob>();
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
