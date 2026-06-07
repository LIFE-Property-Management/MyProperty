namespace MyProperty.Application.Auth.Commands.RegisterLandlord;

public sealed record RegisterLandlordCommand(
    string Email,
    string FirstName,
    string LastName,
    string? Phone,
    string Password);

public sealed record RegisterLandlordResultDto(string KeycloakUserId, string LoginUrl);
