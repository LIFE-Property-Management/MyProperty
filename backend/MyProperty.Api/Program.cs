using System.Threading.RateLimiting;
using Asp.Versioning;
using MyProperty.Api.HealthChecks;
using Asp.Versioning.ApiExplorer;
using FluentValidation;
using Hangfire;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.OpenApi;
using MyProperty.Api.Auth;
using MyProperty.Api.Errors;
using MyProperty.Api.Hangfire;
using MyProperty.Api.Hubs;
using MyProperty.Api.Logging;
using MyProperty.Api.Middleware;
using MyProperty.Api.Options;
using MyProperty.Api.Swagger;
using MyProperty.Application.Auth.Commands.RegisterLandlord;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Notifications;
using MyProperty.Application.Common.Options;
using MyProperty.Application.Invites.Commands.AcceptInvite;
using MyProperty.Application.Invites.Commands.CreateInvite;
using MyProperty.Application.Invites.Commands.RejectInvite;
using MyProperty.Application.Invites.Queries.GetInviteByToken;
using MyProperty.Application.Landlord.Queries.GetLandlordDashboard;
using MyProperty.Application.Landlord.Queries.GetLandlordTenants;
using MyProperty.Application.Landlord.Queries.GetTenantDetail;
using MyProperty.Application.Leases.Commands.TerminateLease;
using MyProperty.Application.Leases.Queries.GetLandlordLeases;
using MyProperty.Application.Leases.Queries.GetLeasesExpiringSoon;
using MyProperty.Application.Leases.Queries.GetTenantLease;
using MyProperty.Application.Payments.Commands.ConfirmPayment;
using MyProperty.Application.Payments.Commands.CreatePayment;
using MyProperty.Application.Payments.Commands.RejectPayment;
using MyProperty.Application.Payments.Commands.SubmitPayment;
using MyProperty.Application.Payments.Queries.DownloadReceipt;
using MyProperty.Application.Properties.Commands.CreateProperty;
using MyProperty.Application.Properties.Queries.GetLandlordProperties;
using MyProperty.Infrastructure;
using MyProperty.Infrastructure.Identity;
using MyProperty.Infrastructure.Jobs;
using Prometheus;
using Serilog;
using Serilog.Events;
using Serilog.Formatting.Compact;

// Bootstrap logger captures events during startup, before the full Serilog pipeline
// is configured via UseSerilog below. CreateBootstrapLogger() ensures these early
// events are forwarded to the real sinks once the host starts.
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console(new CompactJsonFormatter())
    .CreateBootstrapLogger();

try
{
    // Disable Microsoft's legacy inbound claim mapping so JWT claims are read by
    // their original short names (sub, email, etc.) rather than rewritten to long
    // URI-style names. Must run before any token validation.
    Microsoft.IdentityModel.JsonWebTokens.JsonWebTokenHandler.DefaultInboundClaimTypeMap.Clear();

    var builder = WebApplication.CreateBuilder(args);

    // ── Serilog ───────────────────────────────────────────────────────────────────
    // Config lives here in code only — no ReadFrom.Configuration() — so there is no
    // Serilog section in appsettings.json. Logs are emitted as CLEF JSON on stdout;
    // Promtail scrapes the container's stdout and ships it to Loki (see the monitoring
    // Helm chart). The app deliberately does NOT push to Loki directly — one ingestion
    // path, uniform across every service, and crash output is still captured.
    builder.Host.UseSerilog((_, _, cfg) =>
    {
        cfg.MinimumLevel.Information()
           .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
           .MinimumLevel.Override("System", LogEventLevel.Warning)
           .MinimumLevel.Override("Microsoft.EntityFrameworkCore.Database.Command", LogEventLevel.Warning)
           .Enrich.FromLogContext()
           .WriteTo.Console(new CompactJsonFormatter());
    });

    // ── Keycloak options ──────────────────────────────────────────────────────────
    builder.Services.AddOptions<KeycloakOptions>()
        .Bind(builder.Configuration.GetSection(KeycloakOptions.SectionName))
        .ValidateDataAnnotations()
        .ValidateOnStart();

    // Application-layer view of public Keycloak settings (authority URL for
    // building login URLs in response DTOs). Same section as KeycloakOptions.
    builder.Services.AddOptions<KeycloakPublicOptions>()
        .Bind(builder.Configuration.GetSection(KeycloakPublicOptions.SectionName))
        .ValidateDataAnnotations()
        .ValidateOnStart();

    var keycloakAuthority = builder.Configuration[$"{KeycloakOptions.SectionName}:Authority"]
        ?? throw new InvalidOperationException("Keycloak:Authority is required.");
    var keycloakMetadataAddress = builder.Configuration[$"{KeycloakOptions.SectionName}:MetadataAddress"];

    // ── Authentication ────────────────────────────────────────────────────────────
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.Authority = keycloakAuthority;
            // When MetadataAddress is set, JWKS discovery uses it instead of
            // {Authority}/.well-known/openid-configuration. Lets the API pod
            // reach Keycloak on the cluster-internal URL while Authority stays
            // the browser-facing public URL that JWT `iss` claims carry. See
            // KeycloakOptions and infrastructure/keycloak/PRODUCTION.md.
            if (!string.IsNullOrWhiteSpace(keycloakMetadataAddress))
            {
                options.MetadataAddress = keycloakMetadataAddress;
            }
            options.RequireHttpsMetadata = builder.Configuration.GetValue(
                "Keycloak:RequireHttpsMetadata", !builder.Environment.IsDevelopment());
            options.TokenValidationParameters = new()
            {
                // Issuer validation: tokens are minted against the browser-facing
                // Authority (e.g. http://localhost:8080/realms/MyProperty), so the
                // `iss` claim is that URL. Pin it explicitly — otherwise, because
                // MetadataAddress points at the cluster-internal Keycloak, the
                // handler would validate against the discovery doc's issuer
                // (keycloak:8080) and reject every real browser token.
                ValidIssuer = keycloakAuthority,
                // Audience validation: tokens must carry "myproperty-api" in the
                // `aud` claim. The mapper that writes this claim lives on the
                // `myproperty-frontend` client in realm-export.json, and the
                // `myproperty-api` bearer-only client in the same file exists
                // purely as the audience target.
                ValidateAudience = true,
                ValidAudience = "myproperty-api",
                NameClaimType = "preferred_username",
            };

            // SignalR's WebSocket handshake cannot carry an Authorization
            // header on browsers, so the standard pattern is to pass the JWT
            // via the ?access_token= query string and lift it into the bearer
            // pipeline here. Restricted to /hubs/* so the query-string token
            // never affects REST endpoints (where the header is the contract).
            options.Events = new JwtBearerEvents
            {
                OnMessageReceived = ctx =>
                {
                    var accessToken = ctx.Request.Query["access_token"];
                    var path = ctx.HttpContext.Request.Path;
                    if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
                    {
                        ctx.Token = accessToken;
                    }
                    return Task.CompletedTask;
                },
            };
        });

    builder.Services.AddTransient<IClaimsTransformation, KeycloakRolesTransformer>();

    // ── Current-user abstraction ──────────────────────────────────────────────────
    builder.Services.AddHttpContextAccessor();
    builder.Services.AddScoped<ICurrentUser, HttpContextCurrentUser>();
    builder.Services.AddScoped<ICurrentUserContext, CurrentUserContext>();
    builder.Services.AddInfrastructure(builder.Configuration);

    // Auth handlers
    builder.Services.AddScoped<RegisterLandlordHandler>();

    // Invite handlers
    builder.Services.AddScoped<CreateInviteHandler>();
    builder.Services.AddScoped<GetInviteByTokenHandler>();
    builder.Services.AddScoped<AcceptInviteHandler>();
    builder.Services.AddScoped<RejectInviteHandler>();

    // Landlord handlers
    builder.Services.AddScoped<GetLandlordDashboardHandler>();
    builder.Services.AddScoped<GetLandlordTenantsHandler>();
    builder.Services.AddScoped<GetTenantDetailHandler>();

    // Property handlers
    builder.Services.AddScoped<CreatePropertyHandler>();
    builder.Services.AddScoped<GetLandlordPropertiesHandler>();

    // Lease handlers
    builder.Services.AddScoped<GetLandlordLeasesHandler>();
    builder.Services.AddScoped<GetLeasesExpiringSoonHandler>();
    builder.Services.AddScoped<GetTenantLeaseHandler>();
    builder.Services.AddScoped<TerminateLeaseHandler>();

    // Payment handlers
    builder.Services.AddScoped<CreatePaymentHandler>();
    builder.Services.AddScoped<SubmitPaymentHandler>();
    builder.Services.AddScoped<ConfirmPaymentHandler>();
    builder.Services.AddScoped<RejectPaymentHandler>();
    builder.Services.AddScoped<DownloadReceiptHandler>();

    // FluentValidation — auto-register every IValidator<T> in the Application assembly.
    builder.Services.AddValidatorsFromAssemblyContaining<CreateInviteCommand>();

    // Invite options
    builder.Services.AddOptions<InviteOptions>()
        .Bind(builder.Configuration.GetSection("Invites"))
        .ValidateDataAnnotations()
        .ValidateOnStart();

    // Anthropic receipt-OCR options. Bound here (not in Infrastructure's
    // AddAiServices) so the app fails fast on a bad Model/TimeoutSeconds, in
    // line with the other options classes. The type lives in
    // Application/Common/Options because Infrastructure consumes it.
    builder.Services.AddOptions<AnthropicOcrOptions>()
        .Bind(builder.Configuration.GetSection(AnthropicOcrOptions.SectionName))
        .ValidateDataAnnotations()
        .ValidateOnStart();

    // ── CORS ──────────────────────────────────────────────────────────────────────
    // Allowed origins are configured per-environment. Strict allowlist (no
    // AllowAnyOrigin) because AllowCredentials is required for the SignalR
    // WebSocket handshake, and the CORS spec forbids `*` together with credentials.
    // Methods and headers default to "any" — restricting them is more maintenance
    // pain than security benefit; the origin allowlist is the real boundary.
    builder.Services.AddOptions<CorsOptions>()
        .Bind(builder.Configuration.GetSection(CorsOptions.SectionName))
        .ValidateDataAnnotations()
        .ValidateOnStart();

    var corsOrigins = builder.Configuration
        .GetSection($"{CorsOptions.SectionName}:AllowedOrigins")
        .Get<string[]>() ?? [];

    builder.Services.AddCors(options =>
    {
        options.AddPolicy("MyPropertyDefault", policy =>
            policy.WithOrigins(corsOrigins)
                .AllowAnyMethod()
                .AllowAnyHeader()
                .AllowCredentials());
    });

    // ── Rate limiting ─────────────────────────────────────────────────────────────
    // Two policies:
    //  • "anon-invite"   per-IP, tight — applied to anonymous invite endpoints to
    //                    deter token enumeration attacks (the 404-vs-200 distinction
    //                    on `GET /invites/by-token/{token}` and the 404-vs-204 on
    //                    `POST /invites/{token}/reject` is otherwise an oracle).
    //  • "authenticated" per-user (sub claim, falls back to IP), looser — covers
    //                    every JWT-protected endpoint.
    // Limits are deliberately conservative for the milestone; tune from telemetry.
    builder.Services.AddRateLimiter(options =>
    {
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

        options.AddPolicy("anon-invite", httpContext =>
            RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 30,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    AutoReplenishment = true,
                }));

        options.AddPolicy("authenticated", httpContext =>
        {
            var sub = httpContext.User.FindFirst("sub")?.Value;
            var key = sub ?? httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            return RateLimitPartition.GetFixedWindowLimiter(
                partitionKey: key,
                factory: _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 120,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                    QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                    AutoReplenishment = true,
                });
        });
    });

    // ── Health checks ─────────────────────────────────────────────────────────────
    // Two probe endpoints:
    //   /health/live  → process responsive. K8s livenessProbe target.
    //   /health/ready → Postgres reachable. K8s readinessProbe target.
    // Redis, RabbitMQ, and Keycloak JWKS are registered as diagnostic checks so they
    // appear in the response body for debugging but do not affect the /ready status
    // code — taking the whole API out of rotation because (e.g.) Redis hiccupped is
    // a worse outage than the degraded landlord dashboard.
    builder.Services.AddHttpClient("keycloak-jwks", client =>
    {
        client.Timeout = TimeSpan.FromSeconds(2);
    });
    builder.Services.AddHealthChecks()
        .AddNpgSql(
            connectionStringFactory: sp => sp.GetRequiredService<IConfiguration>().GetConnectionString("Postgres")!,
            name: "postgres",
            tags: ["ready"])
        .AddRedis(
            connectionStringFactory: sp => sp.GetRequiredService<IConfiguration>()["Cache:RedisConnection"]!,
            name: "redis",
            tags: ["diagnostic"])
        .AddCheck<RabbitMqHealthCheck>(
            name: "rabbitmq",
            tags: ["diagnostic"])
        .AddCheck<KeycloakJwksHealthCheck>(
            name: "keycloak-jwks",
            tags: ["diagnostic"]);

    // ── Authorization ─────────────────────────────────────────────────────────────
    builder.Services.AddAuthorization(options =>
    {
        // Default-deny: every endpoint requires authentication unless it opts out
        // with [AllowAnonymous]. Per-role authorization remains an explicit choice
        // via the named policies below.
        options.FallbackPolicy = new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .Build();

        options.AddPolicy("RequireTenant", p => p.RequireRole("Tenant"));
        options.AddPolicy("RequireLandlord", p => p.RequireRole("Landlord"));
        options.AddPolicy("RequireAdmin", p => p.RequireRole("Admin"));
    });

    // ── Problem Details ───────────────────────────────────────────────────────────
    builder.Services.AddProblemDetails(options =>
    {
        options.CustomizeProblemDetails = ctx =>
        {
            ctx.ProblemDetails.Instance ??= ctx.HttpContext.Request.Path;
            ctx.ProblemDetails.Extensions["traceId"] = ctx.HttpContext.TraceIdentifier;
            ctx.ProblemDetails.Type ??= ProblemTypes.Internal;
        };
    });

    builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

    // ── API Versioning ────────────────────────────────────────────────────────────
    builder.Services
        .AddApiVersioning(options =>
        {
            options.DefaultApiVersion = new ApiVersion(1, 0);
            options.AssumeDefaultVersionWhenUnspecified = true;
            options.ReportApiVersions = true;
        })
        .AddApiExplorer(options =>
        {
            options.GroupNameFormat = "'v'V";
            options.SubstituteApiVersionInUrl = true;
        });

    // ── SignalR (M3.6) ────────────────────────────────────────────────────────────
    // Single hub for server-push notifications. Redis backplane is the default
    // so multiple API instances can fan messages out across all connected
    // clients; the test suite flips SignalR:UseRedisBackplane=false to skip
    // the StackExchange.Redis wiring (no Redis is reachable from the test host).
    builder.Services.AddSingleton<INotificationDispatcher, SignalRNotificationDispatcher>();
    var signalRBuilder = builder.Services.AddSignalR();
    var useRedisBackplane = builder.Configuration.GetValue("SignalR:UseRedisBackplane", defaultValue: true);
    if (useRedisBackplane)
    {
        var redisConnection = builder.Configuration["Cache:RedisConnection"]
            ?? throw new InvalidOperationException(
                "SignalR Redis backplane is enabled but Cache:RedisConnection is missing.");
        signalRBuilder.AddStackExchangeRedis(redisConnection, options =>
        {
            // Channel prefix isolates SignalR pub/sub keys from the cache
            // entries living in the same Redis instance.
            options.Configuration.ChannelPrefix = StackExchange.Redis.RedisChannel.Literal("myproperty.signalr");
        });
    }

    // ── API + Swagger ─────────────────────────────────────────────────────────────
    builder.Services.AddControllers();
    builder.Services.AddEndpointsApiExplorer();
    builder.Services.ConfigureOptions<ConfigureSwaggerOptions>();
    builder.Services.AddSwaggerGen(c =>
    {
        c.EnableAnnotations();
        var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
        var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
        if (File.Exists(xmlPath))
            c.IncludeXmlComments(xmlPath);

        c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
        {
            Name = "Authorization",
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            In = ParameterLocation.Header,
            Description = "Paste a Keycloak access token.",
        });

        c.AddSecurityRequirement(doc => new OpenApiSecurityRequirement
        {
            { new OpenApiSecuritySchemeReference("Bearer", doc, null), new List<string>() },
        });
    });

    // North Star Metric — background worker updates the gauge every 60 s.
    builder.Services.AddHostedService<MyProperty.Api.Metrics.NorthStarMetricWorker>();

    var app = builder.Build();

    // Ensure the configured file-storage root exists. Resolved here (after Build)
    // so the IOptions binding has run and validation has passed. Local impl only —
    // when cloud storage lands this block moves into the impl's startup hook.
    {
        var storageOptions = app.Services
            .GetRequiredService<Microsoft.Extensions.Options.IOptions<FileStorageOptions>>()
            .Value;
        var fullRoot = Path.GetFullPath(storageOptions.LocalRoot);
        Directory.CreateDirectory(fullRoot);
        Log.Information("File storage root: {Root}", fullRoot);
    }

    app.UseExceptionHandler();
    app.UseStatusCodePages();

    // CorrelationIdMiddleware must come before UseSerilogRequestLogging so the
    // correlation ID is already in LogContext when the request log entry is written.
    app.UseMiddleware<CorrelationIdMiddleware>();

    // Suppress request-log spam for endpoints that Prometheus + Docker hit on a
    // 15s schedule. Without this, every scrape produces an Information-level
    // "HTTP GET /metrics responded 200" line in Loki, which buries real request
    // logs and inflates retention storage. Errors still log at Error level.
    app.UseSerilogRequestLogging(options =>
    {
        options.GetLevel = (httpContext, _, ex) =>
        {
            if (ex != null) return LogEventLevel.Error;
            var path = httpContext.Request.Path;
            if (path.StartsWithSegments("/metrics")) return LogEventLevel.Verbose;
            if (path.StartsWithSegments("/api/v1/health")) return LogEventLevel.Verbose;
            return LogEventLevel.Information;
        };
    });

    if (app.Environment.IsDevelopment() || app.Environment.IsStaging())
    {
        var versionProvider = app.Services.GetRequiredService<IApiVersionDescriptionProvider>();
        app.UseSwagger();
        app.UseSwaggerUI(options =>
        {
            foreach (var description in versionProvider.ApiVersionDescriptions)
            {
                options.SwaggerEndpoint(
                    $"/swagger/{description.GroupName}/swagger.json",
                    $"MyProperty API {description.GroupName.ToUpperInvariant()}");
            }
            options.RoutePrefix = "swagger";
        });
    }

    // Forwarded headers must run before everything that observes scheme/host/IP
    // (HTTPS redirect, request logging, rate limiting). Behind Nginx/K8s ingress
    // doing TLS termination, the pod receives plain HTTP with X-Forwarded-Proto:
    // https — without this middleware, UseHttpsRedirection would issue a 301 to
    // a broken URL and the request logs would show the proxy IP instead of the
    // real client. KnownNetworks/KnownProxies are cleared because in Kubernetes
    // the ingress pod IP is allocated dynamically from the cluster CIDR and is
    // not known at config time. The trust boundary is the cluster network: the
    // API pod is only reachable through the ingress, so anything that can set
    // these headers is already a trusted proxy by construction.
    var forwardedHeadersOptions = new ForwardedHeadersOptions
    {
        ForwardedHeaders = Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor
                         | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedProto
                         | Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedHost,
    };

    forwardedHeadersOptions.KnownIPNetworks.Clear();
    forwardedHeadersOptions.KnownProxies.Clear();
    app.UseForwardedHeaders(forwardedHeadersOptions);

    // HTTPS redirect is gated: in Development Kestrel serves HTTP only and a
    // redirect would break every request; in Production/Staging Nginx already
    // terminates TLS and (with forwarded headers above) the middleware sees the
    // request as already-HTTPS — kept on as a defense-in-depth no-op.
    if (!app.Environment.IsDevelopment())
    {
        app.UseHttpsRedirection();
    }

    // HTTP request metrics for Prometheus. 
    // Default label set (code, method, controller, action) is what the alert
    // rules in infrastructure/prometheus/alerts/api.yml expect.
    app.UseHttpMetrics();

    // CORS runs after scheme is correct (so preflight responses carry the right
    // Location semantics) and before authentication (preflight OPTIONS requests
    // carry no Authorization header and must short-circuit before auth runs).
    app.UseCors("MyPropertyDefault");

    app.UseAuthentication();
    app.UseRateLimiter();
    app.UseAuthorization();

    app.UseHangfireDashboard("/hangfire", new DashboardOptions
    {
        Authorization = [new AdminOnlyDashboardFilter()],
        DashboardTitle = "MyProperty — Background Jobs",
    });

    // ── Recurring background jobs ───────────────────────────────────────────────
    // Registered against the already-configured Hangfire (Postgres) storage.
    // Cron expressions are interpreted in UTC (no TimeZone set). The
    // CancellationToken.None below is a Hangfire placeholder in the job
    // expression — at execution Hangfire substitutes a real shutdown-aware
    // token, which each job threads through its repo/SaveChanges/ExecuteDelete
    // calls. The Hangfire server is always enabled (see AddHangfireServer), so
    // these schedules run wherever the API does.
    var recurringJobs = app.Services.GetRequiredService<IRecurringJobManager>();
    recurringJobs.AddOrUpdate<MarkExpiredInvitesJob>(
        "mark-expired-invites", j => j.ExecuteAsync(CancellationToken.None), "0 * * * *");   // hourly
    recurringJobs.AddOrUpdate<OrphanCleanupJob>(
        "orphan-cleanup", j => j.ExecuteAsync(CancellationToken.None), "0 3 * * *");          // 03:00 UTC daily

    app.MapControllers();
    app.MapHub<NotificationsHub>(NotificationsHub.Path);

    // Prometheus scrape target. AllowAnonymous so the scraper does not need a
    // JWT (it lives inside the cluster, hits the cluster-internal hostname).
    // The default-deny fallback policy in AddAuthorization would otherwise
    // bounce every scrape with a 401, leaving the target permanently "down".
    app.MapMetrics().AllowAnonymous();

    // Health endpoints — three endpoints, each with one job.
    //
    //   /live        → process responsive. No checks. K8s livenessProbe.
    //   /ready       → Postgres only. K8s readinessProbe. 503 if Postgres is down.
    //   /diagnostics → all registered checks. Human debugging endpoint; never used
    //                  by K8s. Always 200 unless every check is failing.
    //
    // Diagnostic checks (Redis, RabbitMQ, Keycloak JWKS) deliberately do not gate
    // /ready — see docs/operations/health-probes.md for the reasoning.
    app.MapHealthChecks("/api/v1/health/live", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
    {
        Predicate = _ => false,
        ResponseWriter = HealthChecks.UI.Client.UIResponseWriter.WriteHealthCheckUIResponse,
    }).AllowAnonymous();

    app.MapHealthChecks("/api/v1/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
    {
        Predicate = check => check.Tags.Contains("ready"),
        ResponseWriter = HealthChecks.UI.Client.UIResponseWriter.WriteHealthCheckUIResponse,
    }).AllowAnonymous();

    app.MapHealthChecks("/api/v1/health/diagnostics", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
    {
        Predicate = _ => true,
        ResponseWriter = HealthChecks.UI.Client.UIResponseWriter.WriteHealthCheckUIResponse,
    }).AllowAnonymous();

    app.Run();
    return 0;
}
catch (Exception ex)
{
    Log.Fatal(ex, "Host terminated unexpectedly");
    return 1;
}
finally
{
    Log.CloseAndFlush();
}

public partial class Program;
