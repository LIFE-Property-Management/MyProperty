    using Serilog.Context;

    namespace MyProperty.Api.Logging;

    public class CorrelationIdMiddleware(RequestDelegate next)
    {
        private const string HeaderName = "X-Correlation-Id";

        public async Task InvokeAsync(HttpContext context)
        {
            var rawHeader = context.Request.Headers[HeaderName].FirstOrDefault();
            var correlationId = IsValidCorrelationId(rawHeader)
                ? rawHeader!
                : Guid.NewGuid().ToString("N");

            context.Response.Headers[HeaderName] = correlationId;

            using (LogContext.PushProperty("CorrelationId", correlationId))
            {
                await next(context);
            }
        }
        
        private static bool IsValidCorrelationId(string? value) =>
            !string.IsNullOrEmpty(value) && value.Length <= 64 && value.All(char.IsAsciiLetterOrDigit);
    }
