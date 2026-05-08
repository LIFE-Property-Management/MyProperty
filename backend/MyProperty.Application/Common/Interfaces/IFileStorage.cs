namespace MyProperty.Application.Common.Interfaces;

/// <summary>
/// Abstraction over receipt (and future) file storage. The MVP implementation
/// is local filesystem (<c>LocalFileStorage</c>); cloud storage is post-M3.
/// </summary>
/// <remarks>
/// <para>
/// <b>Signed URLs are deliberately omitted</b> for the MVP. The interface
/// will gain a <c>GetSignedUrlAsync</c> method when a cloud implementation
/// lands; until then, downloads stream through the API via
/// <see cref="DownloadAsync"/>.
/// </para>
/// </remarks>
public interface IFileStorage
{
    /// <summary>
    /// Persists the stream and returns an opaque storage key the caller stores
    /// alongside the owning aggregate (e.g., on <c>Payment.ReceiptFileKey</c>).
    /// </summary>
    /// <param name="content">File contents. The implementation is responsible for reading to end.</param>
    /// <param name="fileName">Original filename from the client (used to derive the extension).</param>
    /// <param name="contentType">MIME type from the upload.</param>
    /// <param name="ct">Cancellation token.</param>
    /// <returns>The storage key. Format is implementation-defined and opaque to callers.</returns>
    Task<string> UploadAsync(Stream content, string fileName, string contentType, CancellationToken ct);

    /// <summary>
    /// Opens a read stream for the file identified by <paramref name="fileKey"/>.
    /// Caller must dispose. Throws <see cref="FileNotFoundException"/> if the key resolves to no file.
    /// </summary>
    Task<Stream> DownloadAsync(string fileKey, CancellationToken ct);

    /// <summary>
    /// Deletes the file identified by <paramref name="fileKey"/>. No-op if it does not exist.
    /// </summary>
    Task DeleteAsync(string fileKey, CancellationToken ct);
}
