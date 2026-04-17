import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resetTenantStore } from "@/test-utils/resetTenantStore";
import useTenantStore from "@/lib/store/useTenantStore";

// Mock the mutation hook. mutateAsync is what the form awaits.
const mutateAsync = jest.fn();

jest.mock("../../../../lib/hooks", () => ({
  useSubmitManualRequest: () => ({
    mutateAsync,
    isPending: false,
  }),
}));

import { ManualRequestForm } from "../ManualRequestForm";

const PAYMENT_ID = "d6e2f9b4-3c7a-4f1e-8a92-1b5c8d4e7f30";

beforeEach(() => {
  resetTenantStore();
  mutateAsync.mockReset();
});

describe("<ManualRequestForm />", () => {
  it("renders a textarea and a submit button", () => {
    render(<ManualRequestForm paymentId={PAYMENT_ID} onSuccess={() => {}} />);
    expect(screen.getByLabelText(/payment details/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send request/i })).toBeInTheDocument();
  });

  it("blocks submission when notes are empty and shows a validation error", async () => {
    const onSuccess = jest.fn();
    render(<ManualRequestForm paymentId={PAYMENT_ID} onSuccess={onSuccess} />);
    await userEvent.click(screen.getByRole("button", { name: /send request/i }));
    await screen.findByText(/describe the cash payment|empty|required|too small/i);
    expect(mutateAsync).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("submits and invokes onSuccess + success notification on happy path", async () => {
    mutateAsync.mockResolvedValueOnce(undefined);
    const onSuccess = jest.fn();
    render(<ManualRequestForm paymentId={PAYMENT_ID} onSuccess={onSuccess} />);
    await userEvent.type(
      screen.getByLabelText(/payment details/i),
      "Paid 350 EUR cash on Friday 10am",
    );
    await userEvent.click(screen.getByRole("button", { name: /send request/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith({
      paymentId: PAYMENT_ID,
      notes: "Paid 350 EUR cash on Friday 10am",
    });
    expect(onSuccess).toHaveBeenCalled();
    expect(useTenantStore.getState().notifications[0]).toMatchObject({
      type: "success",
    });
  });

  it("shows an error notification and keeps the form open on failure", async () => {
    mutateAsync.mockRejectedValueOnce(new Error("boom"));
    const onSuccess = jest.fn();
    render(<ManualRequestForm paymentId={PAYMENT_ID} onSuccess={onSuccess} />);
    await userEvent.type(
      screen.getByLabelText(/payment details/i),
      "Tried to pay cash",
    );
    await userEvent.click(screen.getByRole("button", { name: /send request/i }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    expect(onSuccess).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(useTenantStore.getState().notifications[0]).toMatchObject({
        type: "error",
      });
    });
  });
});
