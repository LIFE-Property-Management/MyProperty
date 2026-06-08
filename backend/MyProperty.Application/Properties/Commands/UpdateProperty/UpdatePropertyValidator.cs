using FluentValidation;

namespace MyProperty.Application.Properties.Commands.UpdateProperty;

public sealed class UpdatePropertyValidator : AbstractValidator<UpdatePropertyCommand>
{
    public UpdatePropertyValidator()
    {
        RuleFor(x => x.PropertyId).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(256);
        RuleFor(x => x.Address).NotEmpty().MaximumLength(512);
        RuleFor(x => x.UnitNumber).MaximumLength(32).When(x => x.UnitNumber is not null);
    }
}
