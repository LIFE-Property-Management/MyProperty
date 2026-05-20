using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.Extensions.Logging;
using MyProperty.Api.Errors;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Domain.Exceptions;
using AppValidationException = MyProperty.Application.Common.Exceptions.ValidationException;

namespace MyProperty.Api.Middleware;

internal sealed class GlobalExceptionHandler(
    IProblemDetailsService problemDetailsService,
    ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var problem = exception switch
        {
            AppValidationException v => BuildValidation(v),
            NotFoundException n => BuildNotFound(n),
            ForbiddenException f => BuildForbidden(f),
            ConflictException c => BuildConflict(c),
            LeaseAlreadyTerminatedException l => BuildLeaseAlreadyTerminated(l),
            _ => BuildInternal(exception, logger),
        };

        httpContext.Response.StatusCode = problem.Status ?? StatusCodes.Status500InternalServerError;

        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problem,
            Exception = exception,
        });
    }

    private static ProblemDetails BuildValidation(AppValidationException ex)
    {
        var problem = new ValidationProblemDetails(ex.Errors.ToDictionary(kv => kv.Key, kv => kv.Value))
        {
            Title = "One or more validation errors occurred.",
            Status = StatusCodes.Status400BadRequest,
            Type = ProblemTypes.Validation,
            Detail = ex.Message,
        };
        return problem;
    }

    private static ProblemDetails BuildNotFound(NotFoundException ex) => new()
    {
        Title = "Resource not found.",
        Status = StatusCodes.Status404NotFound,
        Type = ProblemTypes.NotFound,
        Detail = ex.Message,
        Extensions = { ["resource"] = ex.Resource, ["key"] = ex.Key },
    };

    private static ProblemDetails BuildForbidden(ForbiddenException ex) => new()
    {
        Title = "Forbidden.",
        Status = StatusCodes.Status403Forbidden,
        Type = ProblemTypes.Forbidden,
        Detail = ex.Message,
    };

    private static ProblemDetails BuildConflict(ConflictException ex) => new()
    {
        Title = "Conflict.",
        Status = StatusCodes.Status409Conflict,
        Type = ProblemTypes.Conflict,
        Detail = ex.Message,
    };

    private static ProblemDetails BuildInternal(Exception ex, ILogger logger)
    {
        logger.LogError(ex, "Unhandled exception bubbled to GlobalExceptionHandler");
        return new ProblemDetails
        {
            Title = "An unexpected error occurred.",
            Status = StatusCodes.Status500InternalServerError,
            Type = ProblemTypes.Internal,
            Detail = "Please retry; if the problem persists, contact support.",
        };
    }

    private static ProblemDetails BuildLeaseAlreadyTerminated(LeaseAlreadyTerminatedException ex) => new()
    {
        Title = "Lease already terminated.",
        Status = StatusCodes.Status409Conflict,
        Type = ProblemTypes.Conflict,
        Detail = ex.Message,
    };
}
