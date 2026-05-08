using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MyProperty.Application.Common.Interfaces;
using MyProperty.Application.Common.Options;

namespace MyProperty.Infrastructure.Storage;

/// <summary>
/// Filesystem-backed <see cref="IFileStorage"/> for the M3.9 MVP. Files are
/// stored under <c>{LocalRoot}/receipts/{yyyy}/{MM}/{guid}{ext}</c>; the storage
/// key is the relative path beneath <c>LocalRoot</c>, with forward-slash
/// separators regardless of host OS.
/// </summary>
/// <remarks>
/// <para>
/// <b>Path traversal hardening.</b> <see cref="DownloadAsync"/> and
/// <see cref="DeleteAsync"/> resolve the requested key under <c>LocalRoot</c>
/// and reject any resulting path that escapes the root. This guards against
/// keys like <c>../../etc/passwd</c> sneaking out of the storage tree.
/// </para>
/// <para>
/// <b>No content validation here.</b> Size and MIME validation runs in
/// <c>SubmitPaymentValidator</c> at the request boundary. This class trusts
/// its inputs.
/// </para>
/// </remarks>
public sealed class LocalFileStorage(
    IOptions<FileStorageOptions> options,
    ILogger<LocalFileStorage> logger) : IFileStorage
{
    private readonly FileStorageOptions _options = options.Value;

    public async Task<string> UploadAsync(
        Stream content, string fileName, string contentType, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(content);
        ArgumentException.ThrowIfNullOrWhiteSpace(fileName);
        ArgumentException.ThrowIfNullOrWhiteSpace(contentType);

        var now = DateTime.UtcNow;
        var ext = Path.GetExtension(fileName);
        var newName = $"{Guid.NewGuid():N}{ext}";
        var relativeKey = $"receipts/{now:yyyy}/{now:MM}/{newName}";

        var fullPath = ResolveAbsolutePath(relativeKey);
        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);

        await using (var fs = new FileStream(fullPath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
        {
            await content.CopyToAsync(fs, ct);
        }

        logger.LogInformation("Stored receipt at {Key} ({Bytes} bytes, {ContentType})",
            relativeKey, new FileInfo(fullPath).Length, contentType);

        return relativeKey;
    }

    public Task<Stream> DownloadAsync(string fileKey, CancellationToken ct)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(fileKey);

        var fullPath = ResolveAbsolutePath(fileKey);
        if (!File.Exists(fullPath))
            throw new FileNotFoundException("Receipt file not found.", fileKey);

        Stream stream = new FileStream(
            fullPath, FileMode.Open, FileAccess.Read, FileShare.Read,
            bufferSize: 81920, useAsync: true);

        return Task.FromResult(stream);
    }

    public Task DeleteAsync(string fileKey, CancellationToken ct)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(fileKey);

        var fullPath = ResolveAbsolutePath(fileKey);
        if (File.Exists(fullPath))
            File.Delete(fullPath);

        return Task.CompletedTask;
    }

    /// <summary>
    /// Resolves a storage key to an absolute path, rejecting traversal attempts.
    /// </summary>
    private string ResolveAbsolutePath(string key)
    {
        var rootFull = Path.GetFullPath(_options.LocalRoot);
        var combined = Path.GetFullPath(Path.Combine(rootFull, key));

        // Normalise root with trailing separator so a prefix check is safe.
        var rootWithSep = rootFull.EndsWith(Path.DirectorySeparatorChar)
            ? rootFull
            : rootFull + Path.DirectorySeparatorChar;

        if (!combined.StartsWith(rootWithSep, StringComparison.Ordinal))
            throw new InvalidOperationException(
                $"Resolved storage path '{combined}' escapes configured root '{rootFull}'.");

        return combined;
    }
}
