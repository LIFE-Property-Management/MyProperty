using FluentValidation;

namespace MyProperty.Application.Invites.Commands.ResendInvite;

public sealed class ResendInviteValidator : AbstractValidator<ResendInviteCommand>
{
    public ResendInviteValidator()
    {
        RuleFor(x => x.InviteId).NotEmpty();
    }
}
