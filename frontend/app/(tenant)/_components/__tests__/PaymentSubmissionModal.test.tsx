import { render, screen } from "@testing-library/react";
import { resetTenantStore } from "@/test-utils/resetTenantStore";
import useTenantStore from "@/lib/store/useTenantStore";

// The modal shell delegates actual form rendering to the child forms. We mock
// those to isolate the shell's routing logic.
jest.mock("../ReceiptUploadForm", () => ({
  ReceiptUploadForm: (props: { paymentId: string; onSuccess: () => void }) => (
    <div data-testid="receipt-form" data-payment-id={props.paymentId} />
  ),
}));
jest.mock("../ManualRequestForm", () => ({
  ManualRequestForm: (props: { paymentId: string; onSuccess: () => void }) => (
    <div data-testid="manual-form" data-payment-id={props.paymentId} />
  ),
}));

import { PaymentSubmissionModal } from "../PaymentSubmissionModal";

beforeEach(() => resetTenantStore());

describe("<PaymentSubmissionModal />", () => {
  it("renders nothing when no modal is active", () => {
    render(<PaymentSubmissionModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders ReceiptUploadForm inside a dialog when activeModal='receiptUpload'", () => {
    useTenantStore.getState().openModal("receiptUpload", "pay-1");
    render(<PaymentSubmissionModal />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Upload Receipt" })).toBeInTheDocument();
    const form = screen.getByTestId("receipt-form");
    expect(form).toHaveAttribute("data-payment-id", "pay-1");
    expect(screen.queryByTestId("manual-form")).not.toBeInTheDocument();
  });

  it("renders ManualRequestForm inside a dialog when activeModal='manualRequest'", () => {
    useTenantStore.getState().openModal("manualRequest", "pay-42");
    render(<PaymentSubmissionModal />);
    expect(screen.getByRole("heading", { name: "Request Manual Confirmation" })).toBeInTheDocument();
    const form = screen.getByTestId("manual-form");
    expect(form).toHaveAttribute("data-payment-id", "pay-42");
  });

  it("does not render the modal if activeModal is set but activePaymentId is null", () => {
    useTenantStore.setState({ activeModal: "receiptUpload", activePaymentId: null });
    render(<PaymentSubmissionModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
