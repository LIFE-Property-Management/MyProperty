using FluentValidation;

namespace MyProperty.Application.Leases.Commands.TerminateLease;

public sealed class TerminateLeaseValidator : AbstractValidator<TerminateLeaseCommand>
{
    public TerminateLeaseValidator()
    {
        RuleFor(x => x.LeaseId).NotEmpty();
    }
}
