using System.Security.Cryptography;
using System.Text;

namespace MyProperty.Application.Invites;

/// <summary>
/// Hashes invite tokens for storage and lookup. The plain token only ever lives
/// in the invite email body, the Hangfire job arg, and the request URL; the DB
/// stores the lowercase SHA256 hex produced here (<c>Invite.TokenHash</c>, unique).
/// </summary>
public static class InviteTokenHasher
{
    public static string Hash(string plainToken)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(plainToken)))
            .ToLowerInvariant();
}
