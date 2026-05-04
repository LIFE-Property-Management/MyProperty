using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyProperty.Application.Common.Email;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Options;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;

namespace MyProperty.Application.Invites.Commands.CreateInvite;

public sealed class CreateInviteHandler(
    IUserRepository users,
    IPropertyRepository properties,
    IInviteRepository invites,
    IBackgroundJobQueue jobs,
    ICurrentUser currentUser,
    IOptions<InviteOptions> options,
    ILogger<CreateInviteHandler> logger)
{
    public async Task<InviteCreatedDto> Handle(CreateInviteCommand cmd, CancellationToken ct)
    {
        var landlord = await users.GetOrSyncFromClaimsAsync(currentUser.Principal!, ct);

        var property = await properties.GetByIdAsync(cmd.PropertyId, ct)
            ?? throw new NotFoundException("Property", cmd.PropertyId);

        if (property.LandlordId != landlord.Id)
            throw new ForbiddenException("Property does not belong to current landlord.");

        var plainToken = GeneratePlainToken();
        var tokenHash = HashToken(plainToken);

        var invite = new Invite
        {
            LandlordId = landlord.Id,
            PropertyId = cmd.PropertyId,
            Email = cmd.Email,
            FirstName = cmd.FirstName,
            LastName = cmd.LastName,
            TokenHash = tokenHash,
            Status = InviteStatus.Pending,
            ExpiresAt = DateTime.UtcNow.AddDays(options.Value.ExpiryDays),
            ProposedStartDate = cmd.ProposedStartDate,
            ProposedEndDate = cmd.ProposedEndDate,
            ProposedMonthlyRent = cmd.ProposedMonthlyRent,
            Currency = cmd.Currency,
        };

        await invites.AddAsync(invite, ct);
        await invites.SaveChangesAsync(ct);

        logger.LogInformation("Invite {InviteId} created for {Email}", invite.Id, cmd.Email);

        var body = BuildEmailBody(cmd, landlord, property, plainToken, invite.ExpiresAt, options.Value.PortalBaseUrl);
        var message = new EmailMessage(
            cmd.Email,
            $"You've been invited to {property.Name}",
            body,
            IsHtml: true);

        jobs.EnqueueEmail(message);

        return new InviteCreatedDto(invite.Id, invite.ExpiresAt);
    }

    private static string GeneratePlainToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }

    private static string HashToken(string plainToken)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(plainToken)))
            .ToLowerInvariant();

    private static string BuildEmailBody(
        CreateInviteCommand cmd,
        User landlord,
        Property property,
        string plainToken,
        DateTime expiresAt,
        string portalBaseUrl)
    {
        var ctaLink = $"{portalBaseUrl}/invites/{plainToken}";
        return $"""
            <p>Hi {cmd.FirstName},</p>
            <p>{landlord.FirstName} {landlord.LastName} has invited you to lease <strong>{property.Name}</strong>
            located at {property.Address}.</p>
            <p><strong>Proposed terms:</strong> {cmd.ProposedMonthlyRent} {cmd.Currency}
            from {cmd.ProposedStartDate:yyyy-MM-dd} to {cmd.ProposedEndDate:yyyy-MM-dd}.</p>
            <p><a href="{ctaLink}">Review and respond to your invite</a></p>
            <p>This invite expires on {expiresAt:yyyy-MM-dd} UTC.</p>
            """;
    }
}
