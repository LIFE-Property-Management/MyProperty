namespace MyProperty.Application.Common.Interfaces;

public interface IUserAccountProvisioner
{
    /// <summary>
    /// Creates a Keycloak user, sets their password, and assigns a realm role.
    /// Returns the Keycloak <c>sub</c> (user ID) of the newly created user.
    /// Throws <see cref="UserAlreadyExistsException"/> when the email already exists.
    /// </summary>
    Task<string> CreateAsync(ProvisionUserRequest request, CancellationToken ct);
}

public sealed record ProvisionUserRequest(
    string Email,
    string FirstName,
    string LastName,
    string? Phone,
    string Password,
    string RealmRole);

public sealed class UserAlreadyExistsException(string email)
    : Exception($"Keycloak account already exists for {email}.");
