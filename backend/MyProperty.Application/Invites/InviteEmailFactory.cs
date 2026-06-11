using MyProperty.Application.Common.Email;
using MyProperty.Domain.Entities;

namespace MyProperty.Application.Invites;

/// <summary>
/// Builds the tenant-facing invite email (the "review and respond" CTA) from an
/// invite and its property/landlord. Shared by <c>CreateInviteHandler</c> and
/// <c>ResendInviteHandler</c> so the body — and the CTA link shape
/// (<c>{portalBaseUrl}/invites/{plainToken}</c>) — stay in one place. The plain
/// token is passed in (never read from the invite, which only stores the hash).
/// </summary>
public static class InviteEmailFactory
{
    public static EmailMessage Build(
        Invite invite, Property property, User landlord, string plainToken, string portalBaseUrl)
    {
        var ctaLink = $"{portalBaseUrl}/invites/{plainToken}";
        var body = $"""
            <p>Hi {invite.FirstName},</p>
            <p>{landlord.FirstName} {landlord.LastName} has invited you to lease <strong>{property.Name}</strong>
            located at {property.Address}.</p>
            <p><strong>Proposed terms:</strong> {invite.ProposedMonthlyRent} {invite.Currency}
            from {invite.ProposedStartDate:yyyy-MM-dd} to {invite.ProposedEndDate:yyyy-MM-dd}.</p>
            <p><a href="{ctaLink}">Review and respond to your invite</a></p>
            <p>This invite expires on {invite.ExpiresAt:yyyy-MM-dd} UTC.</p>
            """;

        return new EmailMessage(
            invite.Email,
            $"You've been invited to {property.Name}",
            body,
            IsHtml: true);
    }
}
