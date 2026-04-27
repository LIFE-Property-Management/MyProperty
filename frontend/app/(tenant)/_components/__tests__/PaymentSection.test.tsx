import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Payment } from "@/lib/types";
import { renderWithQuery } from "@/test-utils/renderWithQuery";
import { resetTenantStore } from "@/test-utils/resetTenantStore";
import useTenantStore from "@/lib/store/useTenantStore";

const OUTSTANDING: Payment = {
  id: "d6e2f9b4-3c7a-4f1e-8a92-1b5c8d4e7f30",
  leaseId: "1c7e4f88-2d5a-4f93-bb20-7a6c8e1d4f02",
  amount: 350,
  currency: "EUR",
  dueDate: "2026-04-30",
  status: "Outstanding",
  method: null,
  submittedAt: null,
  confirmedAt: null,
  rejectedAt: null,
  rejectionReason: null,
  receiptFileName: null,
  receiptFileUrl: null,
  notes: null,
};

// Mock the data hooks so the test doesn't depend on the HTTP/MSW layer.
// Relative path intentional: Jest's resolver misresolves the `@/` alias from
// inside directories with parentheses (e.g. (tenant)).
jest.mock("../../../../lib/hooks", () => ({
  useCurrentPayment: jest.fn(),
  useAuth: jest.fn(),
}));

import { useCurrentPayment, useAuth } from "../../../../lib/hooks";
import { PaymentSection } from "../PaymentSection";

const mockedUseCurrentPayment = useCurrentPayment as jest.MockedFunction<typeof useCurrentPayment>;
const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function setQueryResult(value: {
  data?: Payment;
  isLoading?: boolean;
  isError?: boolean;
}): void {
  mockedUseCurrentPayment.mockReturnValue({
    data: value.data,
    isLoading: value.isLoading ?? false,
    isError: value.isError ?? false,
  } as unknown as ReturnType<typeof useCurrentPayment>);
}

beforeEach(() => {
  resetTenantStore();
  mockedUseCurrentPayment.mockReset();
  mockedUseAuth.mockReturnValue({
    user: null,
    isAuthenticated: false,
    isReadOnly: false,
    isMeLoading: false,
    signOut: jest.fn(),
  });
});

describe("<PaymentSection />", () => {
  it("shows a spinner while loading", () => {
    setQueryResult({ isLoading: true });
    renderWithQuery(<PaymentSection />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("shows a spinner while /me is loading", () => {
    setQueryResult({ data: OUTSTANDING });
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isReadOnly: false,
      isMeLoading: true,
      signOut: jest.fn(),
    });
    renderWithQuery(<PaymentSection />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("shows an error message when the query errors", () => {
    setQueryResult({ isError: true });
    renderWithQuery(<PaymentSection />);
    expect(screen.getByText(/could not load/i)).toBeInTheDocument();
  });

  it("renders amount + due date and both action buttons for an Outstanding payment", () => {
    setQueryResult({ data: OUTSTANDING });
    renderWithQuery(<PaymentSection />);
    expect(screen.getByText("Current Payment")).toBeInTheDocument();
    expect(screen.getByText("Outstanding")).toBeInTheDocument();
    // amount + currency, format is locale-dependent — just assert the number is present
    expect(screen.getByText((content) => content.includes("350"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload Receipt" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Request Manual Confirmation" }),
    ).toBeInTheDocument();
  });

  it("hides action buttons when the tenant is read-only (even if Outstanding)", () => {
    mockedUseAuth.mockReturnValue({
      user: { portal: "tenant", sub: "u1", email: "a@a.com" },
      isAuthenticated: true,
      isReadOnly: true,
      isMeLoading: false,
      signOut: jest.fn(),
    });
    setQueryResult({ data: OUTSTANDING });
    renderWithQuery(<PaymentSection />);
    expect(screen.queryByRole("button", { name: "Upload Receipt" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Request Manual Confirmation" }),
    ).not.toBeInTheDocument();
  });

  it("renders 'Awaiting landlord confirmation' for Pending", () => {
    setQueryResult({
      data: {
        ...OUTSTANDING,
        status: "Pending",
        method: "ReceiptUpload",
        submittedAt: "2026-04-02T10:15:00Z",
      },
    });
    renderWithQuery(<PaymentSection />);
    expect(screen.getByText(/awaiting landlord confirmation/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upload Receipt" })).not.toBeInTheDocument();
  });

  it("renders 'Payment confirmed' for Confirmed", () => {
    setQueryResult({
      data: {
        ...OUTSTANDING,
        status: "Confirmed",
        method: "ReceiptUpload",
        submittedAt: "2026-04-02T10:15:00Z",
        confirmedAt: "2026-04-03T09:00:00Z",
      },
    });
    renderWithQuery(<PaymentSection />);
    expect(screen.getByText(/payment confirmed/i)).toBeInTheDocument();
  });

  it("shows resubmission buttons + rejection reason for Rejected", () => {
    setQueryResult({
      data: {
        ...OUTSTANDING,
        status: "Rejected",
        method: "ReceiptUpload",
        submittedAt: "2026-04-02T10:15:00Z",
        rejectedAt: "2026-04-04T08:00:00Z",
        rejectionReason: "Wrong amount",
      },
    });
    renderWithQuery(<PaymentSection />);
    expect(screen.getByText(/wrong amount/i)).toBeInTheDocument();
    expect(screen.getByText(/resubmit your payment/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload Receipt" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Request Manual Confirmation" }),
    ).toBeInTheDocument();
  });

  it("opens the receiptUpload modal via the store when 'Upload Receipt' is clicked", async () => {
    setQueryResult({ data: OUTSTANDING });
    renderWithQuery(<PaymentSection />);
    await userEvent.click(screen.getByRole("button", { name: "Upload Receipt" }));
    await waitFor(() => {
      const state = useTenantStore.getState();
      expect(state.activeModal).toBe("receiptUpload");
      expect(state.activePaymentId).toBe(OUTSTANDING.id);
    });
  });

  it("opens the manualRequest modal via the store when 'Request Manual Confirmation' is clicked", async () => {
    setQueryResult({ data: OUTSTANDING });
    renderWithQuery(<PaymentSection />);
    await userEvent.click(
      screen.getByRole("button", { name: "Request Manual Confirmation" }),
    );
    await waitFor(() => {
      const state = useTenantStore.getState();
      expect(state.activeModal).toBe("manualRequest");
      expect(state.activePaymentId).toBe(OUTSTANDING.id);
    });
  });
});
