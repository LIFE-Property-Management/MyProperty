using FluentValidation.TestHelper;
using MyProperty.Application.Payments.Commands.SubmitPayment;
using MyProperty.Domain.Enums;

namespace MyProperty.Tests.Unit.Validators;

public sealed class SubmitPaymentValidatorTests
{
    private const long MaxFileSizeBytes = 5L * 1024 * 1024;

    private readonly SubmitPaymentValidator _sut = new();

    private static SubmitPaymentCommand ManualValid(Guid? paymentId = null, string? notes = null) =>
        new(paymentId ?? Guid.NewGuid(), PaymentMethod.ManualRequest, notes, null, null, null, null);

    private static SubmitPaymentCommand ReceiptValid(
        Guid? paymentId = null,
        Stream? fileStream = null,
        string? fileName = "receipt.png",
        string? contentType = "image/png",
        long? fileSizeBytes = 1024) =>
        new(
            paymentId ?? Guid.NewGuid(),
            PaymentMethod.ReceiptUpload,
            Notes: null,
            FileStream: fileStream ?? new MemoryStream([1, 2, 3]),
            FileName: fileName,
            ContentType: contentType,
            FileSizeBytes: fileSizeBytes);

    [Fact]
    public void ManualRequest_happy_path_passes()
    {
        _sut.TestValidate(ManualValid()).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void ReceiptUpload_happy_path_passes()
    {
        _sut.TestValidate(ReceiptValid()).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void EmptyPaymentId_fails()
    {
        _sut.TestValidate(ManualValid(paymentId: Guid.Empty))
            .ShouldHaveValidationErrorFor(x => x.PaymentId);
    }

    [Fact]
    public void Notes_too_long_fails()
    {
        _sut.TestValidate(ManualValid(notes: new string('a', 501)))
            .ShouldHaveValidationErrorFor(x => x.Notes);
    }

    [Fact]
    public void ReceiptUpload_without_file_stream_fails()
    {
        // Build directly: the ReceiptValid helper would default a null stream back to a MemoryStream.
        var cmd = new SubmitPaymentCommand(
            Guid.NewGuid(), PaymentMethod.ReceiptUpload, null, null, "receipt.png", "image/png", 1024);

        _sut.TestValidate(cmd).ShouldHaveValidationErrorFor(x => x.FileStream);
    }

    [Fact]
    public void ReceiptUpload_without_file_name_fails()
    {
        _sut.TestValidate(ReceiptValid(fileName: ""))
            .ShouldHaveValidationErrorFor(x => x.FileName);
    }

    [Theory]
    [InlineData("image/gif")]
    [InlineData("text/plain")]
    [InlineData("application/zip")]
    public void ReceiptUpload_with_disallowed_content_type_fails(string contentType)
    {
        _sut.TestValidate(ReceiptValid(contentType: contentType))
            .ShouldHaveValidationErrorFor(x => x.ContentType);
    }

    [Theory]
    [InlineData("image/jpeg")]
    [InlineData("image/png")]
    [InlineData("application/pdf")]
    public void ReceiptUpload_with_allowed_content_type_passes(string contentType)
    {
        _sut.TestValidate(ReceiptValid(contentType: contentType))
            .ShouldNotHaveValidationErrorFor(x => x.ContentType);
    }

    [Theory]
    [InlineData(0L)]
    [InlineData(-1L)]
    public void ReceiptUpload_with_non_positive_size_fails(long size)
    {
        _sut.TestValidate(ReceiptValid(fileSizeBytes: size))
            .ShouldHaveValidationErrorFor(x => x.FileSizeBytes);
    }

    [Fact]
    public void ReceiptUpload_over_size_cap_fails()
    {
        _sut.TestValidate(ReceiptValid(fileSizeBytes: MaxFileSizeBytes + 1))
            .ShouldHaveValidationErrorFor(x => x.FileSizeBytes);
    }

    [Fact]
    public void ReceiptUpload_at_size_cap_passes()
    {
        _sut.TestValidate(ReceiptValid(fileSizeBytes: MaxFileSizeBytes))
            .ShouldNotHaveValidationErrorFor(x => x.FileSizeBytes);
    }

    [Fact]
    public void ManualRequest_with_attached_file_fails()
    {
        var cmd = new SubmitPaymentCommand(
            Guid.NewGuid(),
            PaymentMethod.ManualRequest,
            Notes: null,
            FileStream: new MemoryStream([1, 2, 3]),
            FileName: "receipt.png",
            ContentType: "image/png",
            FileSizeBytes: 1024);

        var result = _sut.TestValidate(cmd);
        result.ShouldHaveValidationErrorFor(x => x.FileStream);
        result.ShouldHaveValidationErrorFor(x => x.FileName);
        result.ShouldHaveValidationErrorFor(x => x.ContentType);
        result.ShouldHaveValidationErrorFor(x => x.FileSizeBytes);
    }

    [Fact]
    public void InvalidMethod_fails()
    {
        var cmd = new SubmitPaymentCommand(
            Guid.NewGuid(), (PaymentMethod)99, null, null, null, null, null);

        _sut.TestValidate(cmd).ShouldHaveValidationErrorFor(x => x.Method);
    }
}
