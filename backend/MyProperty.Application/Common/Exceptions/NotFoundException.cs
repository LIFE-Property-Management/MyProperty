namespace MyProperty.Application.Common.Exceptions;

public sealed class NotFoundException : Exception
{
    public string Resource { get; }
    public object Key { get; }

    public NotFoundException(string resource, object key)
        : base($"{resource} '{key}' was not found.")
    {
        Resource = resource;
        Key = key;
    }
}
