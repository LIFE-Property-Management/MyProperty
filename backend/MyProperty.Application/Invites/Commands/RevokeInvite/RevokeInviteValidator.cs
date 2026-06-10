using FluentValidation;

namespace MyProperty.Application.Invites.Commands.RevokeInvite;

public sealed class RevokeInviteValidator : AbstractValidator<RevokeInviteCommand>
{
    public RevokeInviteValidator()
    {
        RuleFor(x => x.InviteId).NotEmpty();
    }
}
