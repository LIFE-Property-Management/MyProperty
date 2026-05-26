using FluentValidation;

namespace MyProperty.Application.Properties.Commands.CreateProperty;

public sealed class CreatePropertyValidator : AbstractValidator<CreatePropertyCommand>
{
    public CreatePropertyValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(256);
        RuleFor(x => x.Address).NotEmpty().MaximumLength(512);
        RuleFor(x => x.UnitNumber).MaximumLength(32).When(x => x.UnitNumber is not null);
    }
}
