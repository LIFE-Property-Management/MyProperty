import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PaymentHistoryResponse } from "@/lib/types";

jest.mock("../../../../lib/hooks", () => ({
  usePaymentHistory: jest.fn(),
}));

import { usePaymentHistory } from "../../../../lib/hooks";
import { PaymentHistoryTable } from "../PaymentHistoryTable";

const mockedUsePaymentHistory = usePaymentHistory as jest.MockedFunction<typeof usePaymentHistory>;

function makeResponse(overrides: Partial<PaymentHistoryResponse> = {}): PaymentHistoryResponse {
  return {
    page: 1,
    pageSize: 10,
    totalCount: 2,
    items: [
      {
        id: "a1111111-1111-4111-8111-111111111111",
        amount: 350,
        currency: "EUR",
        dueDate: "2026-03-31",
        status: "Pending",
        method: "ReceiptUpload",
        submittedAt: "2026-04-02T10:15:00Z",
        confirmedAt: null,
      },
      {
        id: "b2222222-2222-4222-8222-222222222222",
        amount: 350,
        currency: "EUR",
        dueDate: "2026-02-28",
        status: "Confirmed",
        method: "ManualRequest",
        submittedAt: "2026-02-26T14:30:00Z",
        confirmedAt: "2026-02-27T09:12:00Z",
      },
    ],
    ...overrides,
  };
}

function setHistory(value: {
  data?: PaymentHistoryResponse;
  isLoading?: boolean;
  isError?: boolean;
  isFetching?: boolean;
}): void {
  mockedUsePaymentHistory.mockReturnValue({
    data: value.data,
    isLoading: value.isLoading ?? false,
    isError: value.isError ?? false,
    isFetching: value.isFetching ?? false,
  } as unknown as ReturnType<typeof usePaymentHistory>);
}

beforeEach(() => {
  mockedUsePaymentHistory.mockReset();
});

describe("<PaymentHistoryTable />", () => {
  it("shows a spinner while loading", () => {
    setHistory({ isLoading: true });
    render(<PaymentHistoryTable />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("shows an error message on query error", () => {
    setHistory({ isError: true });
    render(<PaymentHistoryTable />);
    expect(screen.getByText(/could not load payment history/i)).toBeInTheDocument();
  });

  it("renders both rows with status badges and method labels", () => {
    setHistory({ data: makeResponse() });
    const { container } = render(<PaymentHistoryTable />);
    // Badges live inside the table body; filter options carry the same label text
    // in the <select>, so we scope the assertions to the tbody.
    const tbody = container.querySelector("tbody")!;
    expect(tbody.textContent).toContain("Pending");
    expect(tbody.textContent).toContain("Confirmed");
    expect(tbody.textContent).toContain("Receipt Upload");
    expect(tbody.textContent).toContain("Manual Request");
  });

  it("filters on the current page by selected status", async () => {
    setHistory({ data: makeResponse() });
    const { container } = render(<PaymentHistoryTable />);
    await userEvent.selectOptions(screen.getByLabelText("Filter by status"), "Confirmed");
    const tbody = container.querySelector("tbody")!;
    expect(tbody.textContent).not.toContain("Pending");
    expect(tbody.textContent).toContain("Confirmed");
  });

  it("shows an empty-state message for filtered pages with zero matches", async () => {
    setHistory({ data: makeResponse() });
    render(<PaymentHistoryTable />);
    await userEvent.selectOptions(screen.getByLabelText("Filter by status"), "Outstanding");
    expect(screen.getByText(/No payments match the "Outstanding" filter/)).toBeInTheDocument();
  });

  it("disables Previous on page 1 and Next on the last page", () => {
    setHistory({ data: makeResponse({ totalCount: 10, page: 1 }) });
    render(<PaymentHistoryTable />);
    expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled();
    // Exactly one page when totalCount === pageSize
    expect(screen.getByRole("button", { name: /Next/ })).toBeDisabled();
  });

  it("shows pagination footer with 'Page X of Y'", () => {
    setHistory({ data: makeResponse({ totalCount: 25, page: 2 }) });
    render(<PaymentHistoryTable />);
    // totalCount=25, pageSize=10 → 3 pages
    expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
  });

  it("advances the page via Next click (next fetch re-triggers via hook)", async () => {
    setHistory({ data: makeResponse({ totalCount: 25, page: 1 }) });
    render(<PaymentHistoryTable />);
    await userEvent.click(screen.getByRole("button", { name: /Next/ }));
    // The hook mock is invoked anew with page=2 on the re-render.
    expect(mockedUsePaymentHistory).toHaveBeenLastCalledWith(2, 10);
  });

  it("resets to page 1 when the status filter changes", async () => {
    setHistory({ data: makeResponse({ totalCount: 25, page: 3 }) });
    render(<PaymentHistoryTable />);
    await userEvent.selectOptions(screen.getByLabelText("Filter by status"), "Confirmed");
    expect(mockedUsePaymentHistory).toHaveBeenLastCalledWith(1, 10);
  });

  it("renders a table caption for screen readers", () => {
    setHistory({ data: makeResponse() });
    const { container } = render(<PaymentHistoryTable />);
    const caption = container.querySelector("caption");
    expect(caption).toHaveTextContent("Payment history");
  });

  it("shows 'Updating…' when the background fetch is in-flight", () => {
    setHistory({ data: makeResponse(), isFetching: true });
    render(<PaymentHistoryTable />);
    expect(screen.getByText(/Updating/)).toBeInTheDocument();
  });
});
