import { render, screen, fireEvent } from "@testing-library/react";
import type { LeaseStatus } from "@/lib/types";

// Mutation hook — capture mutate so we can assert it fires and pass onSuccess.
const cancel = jest.fn();
let isPending = false;
let isError = false;
jest.mock("@/lib/hooks", () => ({
  useCancelLease: () => ({ mutate: cancel, isPending, isError }),
}));

import { CancelLeaseButton } from "../CancelLeaseButton";

beforeEach(() => {
  cancel.mockReset();
  isPending = false;
  isError = false;
});

function renderWith(status: LeaseStatus) {
  return render(<CancelLeaseButton status={status} />);
}

describe("<CancelLeaseButton />", () => {
  it("renders nothing when the lease is not Active (Expired)", () => {
    const { container } = renderWith("Expired");
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the lease is Terminated", () => {
    const { container } = renderWith("Terminated");
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the Cancel lease button only when Active", () => {
    renderWith("Active");
    expect(screen.getByRole("button", { name: "Cancel lease" })).toBeInTheDocument();
  });

  it("opens the confirm modal without cancelling, then cancels on confirm", () => {
    renderWith("Active");

    // Opening the modal must not fire the mutation yet.
    fireEvent.click(screen.getByRole("button", { name: "Cancel lease" }));
    expect(cancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /yes, cancel lease/i }));
    expect(cancel).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("surfaces an error message when the mutation errored", () => {
    isError = true;
    renderWith("Active");
    fireEvent.click(screen.getByRole("button", { name: "Cancel lease" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/could not cancel your lease/i);
  });
});
