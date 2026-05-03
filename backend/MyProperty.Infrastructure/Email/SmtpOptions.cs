using System.ComponentModel.DataAnnotations;

namespace MyProperty.Infrastructure.Email;

public sealed class SmtpOptions
{
    public const string SectionName = "Smtp";

    [Required]
    public string Host { get; init; } = string.Empty;

    [Range(1, 65535)]
    public int Port { get; init; } = 25;

    public string? Username { get; init; }
    public string? Password { get; init; }

    public bool UseStartTls { get; init; }

    [Required, EmailAddress]
    public string FromAddress { get; init; } = string.Empty;

    [Required]
    public string FromName { get; init; } = string.Empty;
}
