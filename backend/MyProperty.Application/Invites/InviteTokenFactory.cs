using System.Security.Cryptography;

namespace MyProperty.Application.Invites;

/// <summary>
/// Issues a fresh invite token: a 32-byte cryptographically-random, URL-safe
/// base64 plain token plus its <see cref="InviteTokenHasher"/> hash. The plain
/// token is returned to the caller (it goes into the email + URL only); the hash
/// is what gets persisted on <c>Invite.TokenHash</c>. Shared by
/// <c>CreateInviteHandler</c> and <c>ResendInviteHandler</c> so token issuance —
/// and the hashing that goes with it — lives in exactly one place.
/// </summary>
public static class InviteTokenFactory
{
    public static IssuedToken Issue()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        var plainToken = Convert.ToBase64String(bytes)
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');

        return new IssuedToken(plainToken, InviteTokenHasher.Hash(plainToken));
    }
}

/// <summary>A freshly-issued invite token: the plain value (email/URL only) and its stored hash.</summary>
public sealed record IssuedToken(string PlainToken, string TokenHash);
