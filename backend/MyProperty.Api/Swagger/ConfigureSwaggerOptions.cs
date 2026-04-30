using Asp.Versioning.ApiExplorer;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace MyProperty.Api.Swagger;

internal sealed class ConfigureSwaggerOptions(IApiVersionDescriptionProvider provider)
    : IConfigureOptions<SwaggerGenOptions>
{
    public void Configure(SwaggerGenOptions options)
    {
        foreach (var description in provider.ApiVersionDescriptions)
        {
            options.SwaggerDoc(description.GroupName, BuildInfo(description));
        }
    }

    private static OpenApiInfo BuildInfo(ApiVersionDescription description)
    {
        var info = new OpenApiInfo
        {
            Title = "MyProperty API",
            Version = description.ApiVersion.ToString(),
            Description = "MyProperty backend — landlord/tenant property management.",
        };

        if (description.IsDeprecated)
        {
            info.Description += " This API version is deprecated.";
        }

        return info;
    }
}
