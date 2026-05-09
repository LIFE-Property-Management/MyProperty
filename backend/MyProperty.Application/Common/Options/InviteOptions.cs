using System.ComponentModel.DataAnnotations;

namespace MyProperty.Application.Common.Options;

public sealed class InviteOptions
{
    [Required]
    [Url]
    public required string PortalBaseUrl { get; set; }

    [Range(1, 30)]
    public int ExpiryDays { get; set; } = 7;
}
