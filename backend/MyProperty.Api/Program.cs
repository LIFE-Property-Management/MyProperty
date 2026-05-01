using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.OpenApi;
using MyProperty.Api.Auth;
using MyProperty.Api.Options;

var builder = WebApplication.CreateBuilder(args);

// ── Keycloak options ──────────────────────────────────────────────────────────
builder.Services.AddOptions<KeycloakOptions>()
    .Bind(builder.Configuration.GetSection(KeycloakOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

var keycloakAuthority = builder.Configuration[$"{KeycloakOptions.SectionName}:Authority"]
    ?? throw new InvalidOperationException("Keycloak:Authority is required.");

// ── Authentication — JWT Bearer validated against Keycloak JWKS ───────────────
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = keycloakAuthority;
        options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
        options.TokenValidationParameters = new()
        {
            ValidateAudience = false,
            NameClaimType = "preferred_username",
        };
    });

// Map Keycloak realm_access.roles → ClaimTypes.Role
builder.Services.AddTransient<IClaimsTransformation, KeycloakRolesTransformer>();

// ── Authorization policies ────────────────────────────────────────────────────
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("RequireTenant",   p => p.RequireRole("Tenant"));
    options.AddPolicy("RequireLandlord", p => p.RequireRole("Landlord"));
    options.AddPolicy("RequireAdmin",    p => p.RequireRole("Admin"));
});

// ── API + Swagger ─────────────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name         = "Authorization",
        Type         = SecuritySchemeType.Http,
        Scheme       = "bearer",
        BearerFormat = "JWT",
        In           = ParameterLocation.Header,
        Description  = "Paste a Keycloak access token.",
    });

    // Swashbuckle v10 / OpenAPI v2: factory receives the host document for reference resolution.
    c.AddSecurityRequirement(doc => new OpenApiSecurityRequirement
    {
        { new OpenApiSecuritySchemeReference("Bearer", doc, null), new List<string>() },
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();
