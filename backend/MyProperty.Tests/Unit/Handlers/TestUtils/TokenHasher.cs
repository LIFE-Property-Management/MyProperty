using System.Security.Cryptography;
using System.Text;

namespace MyProperty.Tests.Unit.Handlers.TestUtils;

internal static class TokenHasher
{
    // Mirrors the private HashToken in invite handlers — extracted so tests can
    // pre-compute the hash that production code would derive from a plain token.
    public static string Hash(string plainToken)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(plainToken)))
            .ToLowerInvariant();
}
