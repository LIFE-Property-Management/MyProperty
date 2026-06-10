using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MyProperty.Application.Common;
using MyProperty.Application.Invites.Commands.AcceptInvite;
using MyProperty.Application.Invites.Commands.ClaimInvite;
using MyProperty.Application.Invites.Commands.CreateInvite;
using MyProperty.Application.Invites.Commands.RejectInvite;
using MyProperty.Application.Invites.Commands.ResendInvite;
using MyProperty.Application.Invites.Commands.RevokeInvite;
using MyProperty.Application.Invites.Queries.GetInviteByToken;
using MyProperty.Application.Invites.Queries.GetLandlordInvites;
using MyProperty.Domain.Enums;

namespace MyProperty.Api.Controllers.V1;

/// <summary>Creates and manages property invites sent to prospective tenants.</summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/invites")]
public sealed class InvitesController(
    CreateInviteHandler create,
    GetInviteByTokenHandler getByToken,
    AcceptInviteHandler accept,
    ClaimInviteHandler claim,
    RejectInviteHandler reject,
    GetLandlordInvitesHandler getLandlordInvites,
    RevokeInviteHandler revoke,
    ResendInviteHandler resend) : ControllerBase
{
    /// <summary>
    /// Lists the authenticated landlord's invites (newest first), optionally
    /// filtered by status. Drives the dedicated <c>/dashboard/invites</c> page.
    /// </summary>
    [HttpGet]
    [Authorize(Policy = "RequireLandlord")]
    [EnableRateLimiting("authenticated")]
    [ProducesResponseType(typeof(PagedResult<InviteListItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<PagedResult<InviteListItemDto>>> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] InviteStatus? status = null,
        CancellationToken ct = default)
        => Ok(await getLandlordInvites.Handle(
            new GetLandlordInvitesQuery(page, pageSize, status), ct));

    /// <summary>Creates an invite for a tenant. Email/FirstName/LastName are the invitee's fields.</summary>
    [HttpPost]
    [Authorize(Policy = "RequireLandlord")]
    [EnableRateLimiting("authenticated")]
    [ProducesResponseType(typeof(InviteCreatedDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<InviteCreatedDto>> Create(
        CreateInviteCommand cmd, CancellationToken ct)
        => Ok(await create.Handle(cmd, ct));

    /// <summary>Returns an invite preview for anonymous display. Returns 404 for non-Pending or expired invites.</summary>
    [HttpGet("by-token/{token}")]
    [AllowAnonymous]
    [EnableRateLimiting("anon-invite")]
    [ProducesResponseType(typeof(InvitePreviewDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<InvitePreviewDto>> Preview(
        string token, CancellationToken ct)
        => Ok(await getByToken.Handle(new GetInviteByTokenQuery(token), ct));

    /// <summary>Accepts an invite. Token is the auth — no JWT required. Creates the Keycloak user, User row, and Lease in one atomic operation.</summary>
    [HttpPost("{token}/accept")]
    [AllowAnonymous]
    [EnableRateLimiting("anon-invite")]
    [ProducesResponseType(typeof(InviteAcceptedDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<InviteAcceptedDto>> Accept(
        string token, AcceptInviteBody body, CancellationToken ct)
        => Ok(await accept.Handle(
            new AcceptInviteCommand(token, body.FirstName, body.LastName, body.Phone, body.Password), ct));

    /// <summary>
    /// Claims an invite as an authenticated returning tenant. The JWT email must
    /// match the invite email (else 403). Reuses the existing account — no Keycloak
    /// provisioning — and creates the Lease while marking the invite Accepted.
    /// </summary>
    [HttpPost("{token}/claim")]
    [Authorize(Policy = "RequireTenant")]
    [EnableRateLimiting("authenticated")]
    [ProducesResponseType(typeof(InviteAcceptedDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<InviteAcceptedDto>> Claim(
        string token, CancellationToken ct)
        => Ok(await claim.Handle(new ClaimInviteCommand(token), ct));

    /// <summary>Rejects an invite. Anonymous — no authentication required.</summary>
    [HttpPost("{token}/reject")]
    [AllowAnonymous]
    [EnableRateLimiting("anon-invite")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Reject(
        string token, CancellationToken ct)
    {
        await reject.Handle(new RejectInviteCommand(token), ct);
        return NoContent();
    }

    /// <summary>
    /// Revokes one of the landlord's own invites (cancels it). Only Pending or
    /// Expired invites can be revoked; the invite transitions to Revoked.
    /// </summary>
    [HttpPost("{id:guid}/revoke")]
    [Authorize(Policy = "RequireLandlord")]
    [EnableRateLimiting("authenticated")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Revoke(Guid id, CancellationToken ct)
    {
        await revoke.Handle(new RevokeInviteCommand(id), ct);
        return NoContent();
    }

    /// <summary>
    /// Re-issues one of the landlord's own Pending or Expired invites: a fresh
    /// token is generated (the old link stops working), the expiry resets, and
    /// the invite email is re-sent.
    /// </summary>
    [HttpPost("{id:guid}/resend")]
    [Authorize(Policy = "RequireLandlord")]
    [EnableRateLimiting("authenticated")]
    [ProducesResponseType(typeof(InviteResentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<InviteResentDto>> Resend(Guid id, CancellationToken ct)
        => Ok(await resend.Handle(new ResendInviteCommand(id), ct));
}
