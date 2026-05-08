using System.ComponentModel.DataAnnotations;

namespace MyProperty.Application.Common.Options;

/// <summary>
/// Bound from the <c>FileStorage</c> configuration section.
/// </summary>
public sealed class FileStorageOptions
{
    public const string SectionName = "FileStorage";

    /// <summary>
    /// Filesystem root where uploaded files are persisted. May be relative
    /// (resolved against the API's working directory) or absolute. The
    /// directory is created at startup if missing.
    /// </summary>
    [Required, MinLength(1)]
    public required string LocalRoot { get; set; }
}
