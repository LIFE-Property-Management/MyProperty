using System.Threading.RateLimiting;
using Asp.Versioning;
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
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Notifications;
using MyProperty.Application.Common.Options;
using MyProperty.Application.Invites.Commands.AcceptInvite;
using MyProperty.Application.Invites.Commands.CreateInvite;
using MyProperty.Application.Invites.Commands.RejectInvite;
using MyProperty.Application.Invites.Queries.GetInviteByToken;
using MyProperty.Application.Landlord.Queries.GetLandlordDashboard;
using MyProperty.Application.Payments.Commands.ConfirmPayment;
using MyProperty.Application.Payments.Commands.CreatePayment;
using MyProperty.Application.Payments.Commands.RejectPayment;
using MyProperty.Application.Payments.Commands.SubmitPayment;
using MyProperty.Infrastructure;
using Serilog;
using Serilog.Events;
using Serilog.Formatting.Compact;
using Serilog.Sinks.Grafana.Loki;

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
    // Config lives here in code only — no ReadFrom.Configuration() — so there is
    // no Serilog section in appsettings.json. The Loki URL is the only value read
    // from config (it's infrastructure plumbing, not logger behaviour).
    builder.Host.UseSerilog((ctx, _, cfg) =>
    {
        cfg.MinimumLevel.Information()
           .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
           .MinimumLevel.Override("System", LogEventLevel.Warning)
           .MinimumLevel.Override("Microsoft.EntityFrameworkCore.Database.Command", LogEventLevel.Warning)
           .Enrich.FromLogContext()
           .WriteTo.Console(new CompactJsonFormatter());

        var lokiUrl = ctx.Configuration["LokiUrl"];
        if (!string.IsNullOrWhiteSpace(lokiUrl))
        {
            cfg.WriteTo.GrafanaLoki(
                lokiUrl,
                labels: [new LokiLabel { Key = "app", Value = "myproperty-api" }],
                batchPostingLimit: builder.Environment.IsDevelopment() ? 1 : 100
            );
        }
    });

    // ── Keycloak options ──────────────────────────────────────────────────────────
    builder.Services.AddOptions<KeycloakOptions>()
        .Bind(builder.Configuration.GetSection(KeycloakOptions.SectionName))
        .ValidateDataAnnotations()
        .ValidateOnStart();

    var keycloakAuthority = builder.Configuration[$"{KeycloakOptions.SectionName}:Authority"]
        ?? throw new InvalidOperationException("Keycloak:Authority is required.");

    // ── Authentication ────────────────────────────────────────────────────────────
    builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.Authority = keycloakAuthority;
            options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
            options.TokenValidationParameters = new()
            {
                // TODO(M3.2 follow-up, before May 6): enable audience validation.
                //   Requires (1) adding an audience mapper to a `myproperty-api` client
                //   in infrastructure/keycloak/realm-export.json so the `aud` claim
                //   contains "myproperty-api", and (2) setting
                //     ValidateAudience = true,
                //     ValidAudience   = "myproperty-api"
                //   here. Without this, any token signed by the realm — including tokens
                //   minted for unrelated clients — will be accepted by this API.
                ValidateAudience = false,
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
    builder.Services.AddInfrastructure(builder.Configuration);

    // Invite handlers
    builder.Services.AddScoped<CreateInviteHandler>();
    builder.Services.AddScoped<GetInviteByTokenHandler>();
    builder.Services.AddScoped<AcceptInviteHandler>();
    builder.Services.AddScoped<RejectInviteHandler>();

    // Landlord handlers
    builder.Services.AddScoped<GetLandlordDashboardHandler>();

    // Payment handlers
    builder.Services.AddScoped<CreatePaymentHandler>();
    builder.Services.AddScoped<SubmitPaymentHandler>();
    builder.Services.AddScoped<ConfirmPaymentHandler>();
    builder.Services.AddScoped<RejectPaymentHandler>();

// FluentValidation — auto-register every IValidator<T> in the Application assembly.
builder.Services.AddValidatorsFromAssemblyContaining<CreateInviteCommand>();

// Invite options
builder.Services.AddOptions<InviteOptions>()
    .Bind(builder.Configuration.GetSection("Invites"))
    .ValidateDataAnnotations()
    .ValidateOnStart();

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

// ── Authorization ─────────────────────────────────────────────────────────────
builder.Services.AddAuthorization(options =>
{
    // Default-deny: every endpoint requires authentication unless it opts out
    // with [AllowAnonymous]. Per-role authorization remains an explicit choice
    // via the named policies below.
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();

        options.AddPolicy("RequireTenant",   p => p.RequireRole("Tenant"));
        options.AddPolicy("RequireLandlord", p => p.RequireRole("Landlord"));
        options.AddPolicy("RequireAdmin",    p => p.RequireRole("Admin"));
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
            Name         = "Authorization",
            Type         = SecuritySchemeType.Http,
            Scheme       = "bearer",
            BearerFormat = "JWT",
            In           = ParameterLocation.Header,
            Description  = "Paste a Keycloak access token.",
        });

        c.AddSecurityRequirement(doc => new OpenApiSecurityRequirement
        {
            { new OpenApiSecuritySchemeReference("Bearer", doc, null), new List<string>() },
        });
    });

    var app = builder.Build();

    app.UseExceptionHandler();
    app.UseStatusCodePages();

    // CorrelationIdMiddleware must come before UseSerilogRequestLogging so the
    // correlation ID is already in LogContext when the request log entry is written.
    app.UseMiddleware<CorrelationIdMiddleware>();
    app.UseSerilogRequestLogging();

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

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

app.UseHangfireDashboard("/hangfire", new DashboardOptions
{
    Authorization = [new AdminOnlyDashboardFilter()],
    DashboardTitle = "MyProperty — Background Jobs",
});

    app.MapControllers();
    app.MapHub<NotificationsHub>(NotificationsHub.Path);

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
