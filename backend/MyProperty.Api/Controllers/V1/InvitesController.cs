using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using MyProperty.Application.Invites.Commands.AcceptInvite;
using MyProperty.Application.Invites.Commands.CreateInvite;
using MyProperty.Application.Invites.Commands.RejectInvite;
using MyProperty.Application.Invites.Queries.GetInviteByToken;

namespace MyProperty.Api.Controllers.V1;

/// <summary>Creates and manages property invites sent to prospective tenants.</summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/invites")]
public sealed class InvitesController(
    CreateInviteHandler create,
    GetInviteByTokenHandler getByToken,
    AcceptInviteHandler accept,
    RejectInviteHandler reject) : ControllerBase
{
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
}
