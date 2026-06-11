using FluentValidation;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyProperty.Application.Common.Exceptions;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Options;
using MyProperty.Application.Common.Validation;
using MyProperty.Domain.Entities;
using MyProperty.Domain.Enums;

namespace MyProperty.Application.Invites.Commands.CreateInvite;

public sealed class CreateInviteHandler(
    IValidator<CreateInviteCommand> validator,
    IPropertyRepository properties,
    IInviteRepository invites,
    IBackgroundJobQueue jobs,
    ICurrentUserContext currentUserContext,
    IOptions<InviteOptions> options,
    ILogger<CreateInviteHandler> logger)
{
    public async Task<InviteCreatedDto> Handle(CreateInviteCommand cmd, CancellationToken ct)
    {
        await validator.EnsureValidAsync(cmd, ct);

        var landlord = await currentUserContext.GetOrSyncUserAsync(ct);

        var property = await properties.GetByIdAsync(cmd.PropertyId, ct)
            ?? throw new NotFoundException("Property", cmd.PropertyId);

        if (property.LandlordId != landlord.Id)
            throw new ForbiddenException("Property does not belong to current landlord.");

        var token = InviteTokenFactory.Issue();

        var invite = new Invite
        {
            LandlordId = landlord.Id,
            PropertyId = cmd.PropertyId,
            Email = cmd.Email,
            FirstName = cmd.FirstName,
            LastName = cmd.LastName,
            TokenHash = token.TokenHash,
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

        jobs.EnqueueEmail(InviteEmailFactory.Build(
            invite, property, landlord, token.PlainToken, options.Value.PortalBaseUrl));

        return new InviteCreatedDto(invite.Id, invite.ExpiresAt);
    }
}
