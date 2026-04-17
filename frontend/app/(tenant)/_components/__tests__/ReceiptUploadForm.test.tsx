import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resetTenantStore } from "@/test-utils/resetTenantStore";
import useTenantStore from "@/lib/store/useTenantStore";

const mutateAsync = jest.fn();

jest.mock("../../../../lib/hooks", () => ({
  useSubmitReceipt: () => ({
    mutateAsync,
    isPending: false,
  }),
}));

import { ReceiptUploadForm } from "../ReceiptUploadForm";

const PAYMENT_ID = "d6e2f9b4-3c7a-4f1e-8a92-1b5c8d4e7f30";

function makePdf(name = "receipt.pdf", sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes)], name, { type: "application/pdf" });
}

function makeOversize(): File {
  return new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.pdf", {
    type: "application/pdf",
  });
}

function makeGif(): File {
  return new File([new Uint8Array(1024)], "bad.gif", { type: "image/gif" });
}

beforeEach(() => {
  resetTenantStore();
  mutateAsync.mockReset();
});

describe("<ReceiptUploadForm />", () => {
  it("renders a file input, notes textarea, and submit button", () => {
    render(<ReceiptUploadForm paymentId={PAYMENT_ID} onSuccess={() => {}} />);
    expect(screen.getByLabelText(/receipt/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit receipt/i })).toBeInTheDocument();
  });

  it("blocks submission when no file is selected", async () => {
    const onSuccess = jest.fn();
    render(<ReceiptUploadForm paymentId={PAYMENT_ID} onSuccess={onSuccess} />);
    await userEvent.click(screen.getByRole("button", { name: /submit receipt/i }));
    await waitFor(() => expect(mutateAsync).not.toHaveBeenCalled());
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("rejects files over 5MB with a validation message", async () => {
    render(<ReceiptUploadForm paymentId={PAYMENT_ID} onSuccess={() => {}} />);
    await userEvent.upload(screen.getByLabelText(/receipt/i), makeOversize());
    await userEvent.click(screen.getByRole("button", { name: /submit receipt/i }));
    await waitFor(() => {
      const error = document.getElementById("receipt-error");
      expect(error?.textContent).toMatch(/5MB/);
    });
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("rejects unsupported MIME types (GIF)", async () => {
    render(<ReceiptUploadForm paymentId={PAYMENT_ID} onSuccess={() => {}} />);
    // applyAccept:false bypasses the input's accept="" attribute so our Zod refine
    // is what ultimately rejects the file — the test covers our validation, not the browser's.
    await userEvent.upload(screen.getByLabelText(/receipt/i), makeGif(), {
      applyAccept: false,
    });
    await userEvent.click(screen.getByRole("button", { name: /submit receipt/i }));
    await waitFor(() => {
      const error = document.getElementById("receipt-error");
      expect(error?.textContent).toMatch(/JPEG|PNG|PDF/);
    });
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("submits FormData with paymentId + receipt + notes on happy path", async () => {
    mutateAsync.mockResolvedValueOnce(undefined);
    const onSuccess = jest.fn();
    render(<ReceiptUploadForm paymentId={PAYMENT_ID} onSuccess={onSuccess} />);
    const file = makePdf();
    await userEvent.upload(screen.getByLabelText(/receipt/i), file);
    await userEvent.type(screen.getByLabelText(/notes/i), "paid April rent");
    await userEvent.click(screen.getByRole("button", { name: /submit receipt/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const arg = mutateAsync.mock.calls[0][0] as FormData;
    expect(arg).toBeInstanceOf(FormData);
    expect(arg.get("paymentId")).toBe(PAYMENT_ID);
    expect(arg.get("notes")).toBe("paid April rent");
    const sent = arg.get("receipt");
    expect(sent).toBeInstanceOf(File);
    expect((sent as File).name).toBe("receipt.pdf");
    expect(onSuccess).toHaveBeenCalled();
    await waitFor(() =>
      expect(useTenantStore.getState().notifications[0]).toMatchObject({ type: "success" }),
    );
  });

  it("omits notes from FormData when empty", async () => {
    mutateAsync.mockResolvedValueOnce(undefined);
    render(<ReceiptUploadForm paymentId={PAYMENT_ID} onSuccess={() => {}} />);
    await userEvent.upload(screen.getByLabelText(/receipt/i), makePdf());
    await userEvent.click(screen.getByRole("button", { name: /submit receipt/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    const arg = mutateAsync.mock.calls[0][0] as FormData;
    expect(arg.has("notes")).toBe(false);
  });

  it("shows an error notification and does not call onSuccess on mutation failure", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("network"));
    const onSuccess = jest.fn();
    render(<ReceiptUploadForm paymentId={PAYMENT_ID} onSuccess={onSuccess} />);
    await userEvent.upload(screen.getByLabelText(/receipt/i), makePdf());
    await userEvent.click(screen.getByRole("button", { name: /submit receipt/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(onSuccess).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(useTenantStore.getState().notifications[0]).toMatchObject({ type: "error" }),
    );
  });
});
