namespace MyProperty.Api.Errors;

public static class ProblemTypes
{
    private const string Base = "https://myproperty.app/errors/";

    public const string Validation = Base + "validation";
    public const string NotFound = Base + "not-found";
    public const string Forbidden = Base + "forbidden";
    public const string Conflict = Base + "conflict";
    public const string Internal = Base + "internal";
}
