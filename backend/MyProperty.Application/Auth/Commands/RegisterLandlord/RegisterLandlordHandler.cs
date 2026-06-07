using FluentValidation;
using Microsoft.Extensions.Options;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Options;
using MyProperty.Application.Common.Validation;

namespace MyProperty.Application.Auth.Commands.RegisterLandlord;

public sealed class RegisterLandlordHandler(
    IValidator<RegisterLandlordCommand> validator,
    IUserAccountProvisioner provisioner,
    IOptions<KeycloakPublicOptions> keycloakOptions)
{
    public async Task<RegisterLandlordResultDto> Handle(RegisterLandlordCommand cmd, CancellationToken ct)
    {
        await validator.EnsureValidAsync(cmd, ct);

        var keycloakSub = await provisioner.CreateAsync(new ProvisionUserRequest(
            Email: cmd.Email,
            FirstName: cmd.FirstName,
            LastName: cmd.LastName,
            Phone: cmd.Phone,
            Password: cmd.Password,
            RealmRole: "Landlord"), ct);

        var loginUrl = keycloakOptions.Value.Authority;

        return new RegisterLandlordResultDto(keycloakSub, loginUrl);
    }
}
