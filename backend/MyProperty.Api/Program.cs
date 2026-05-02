using Asp.Versioning;
using Asp.Versioning.ApiExplorer;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.OpenApi;
using MyProperty.Api.Auth;
using MyProperty.Api.Errors;
using MyProperty.Api.Middleware;
using MyProperty.Api.Options;
using MyProperty.Api.Swagger;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Infrastructure;


// Disable Microsoft's legacy inbound claim mapping so JWT claims are read by
// their original short names (sub, email, etc.) rather than rewritten to long
// URI-style names. Must run before any token validation.
Microsoft.IdentityModel.JsonWebTokens.JsonWebTokenHandler.DefaultInboundClaimTypeMap.Clear();

var builder = WebApplication.CreateBuilder(args);

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
    });

builder.Services.AddTransient<IClaimsTransformation, KeycloakRolesTransformer>();

// ── Current-user abstraction ──────────────────────────────────────────────────
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpContextCurrentUser>();
builder.Services.AddInfrastructure(builder.Configuration);

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
app.UseAuthorization();
app.MapControllers();

app.Run();

public partial class Program;
