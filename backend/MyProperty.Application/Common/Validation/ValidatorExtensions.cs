using FluentValidation;

namespace MyProperty.Application.Common.Validation;

public static class ValidatorExtensions
{
    // Runs the validator and rethrows failures as the application's own ValidationException
    // so the global exception handler maps them to RFC 7807 ValidationProblemDetails (400).
    public static async Task EnsureValidAsync<T>(
        this IValidator<T> validator,
        T instance,
        CancellationToken ct)
    {
        var result = await validator.ValidateAsync(instance, ct);
        if (result.IsValid) return;

        var errors = result.Errors
            .GroupBy(e => e.PropertyName)
            .ToDictionary(
                g => g.Key,
                g => g.Select(e => e.ErrorMessage).Distinct().ToArray());

        throw new MyProperty.Application.Common.Exceptions.ValidationException(errors);
    }
}
