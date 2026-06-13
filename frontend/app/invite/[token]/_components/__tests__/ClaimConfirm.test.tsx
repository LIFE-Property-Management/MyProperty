import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { ClaimConfirm } from "../ClaimConfirm";
import type { InvitePreview } from "../../_lib/invite";

// useClaimInvite is mocked so the confirm path is observable without a
// QueryClient/router. The hook owns the redirect; this test owns the gating
// (acknowledge), the submit payload, and the 403 email-mismatch fallback.
const mockMutateAsync = jest.fn();
let mockIsPending = false;

jest.mock("../../_lib/useClaimInvite", () => ({
  useClaimInvite: () => ({ mutateAsync: mockMutateAsync, isPending: mockIsPending }),
}));

const invite: InvitePreview = {
  status: "Pending",
  propertyName: "Maple Court",
  propertyAddress: "123 Main St, Prishtina",
  landlordFullName: "Ada Landlord",
  tenantFirstName: "Jane",
  tenantLastName: "Doe",
  tenantEmail: "tenant@example.com",
  proposedStartDate: "2026-05-01",
  proposedEndDate: "2027-04-30",
  proposedMonthlyRent: 450,
  currency: "EUR",
  expiresAt: "2026-04-24T09:00:00Z",
};

function forbiddenError(): AxiosError {
  return new AxiosError(
    "forbidden",
    "ERR_BAD_REQUEST",
    undefined,
    undefined,
    { status: 403 } as AxiosResponse,
  );
}

beforeEach(() => {
  mockMutateAsync.mockReset();
  mockIsPending = false;
});

describe("ClaimConfirm", () => {
  it("blocks confirming until the lease is acknowledged", () => {
    render(<ClaimConfirm invite={invite} token="tok_123" />);

    fireEvent.click(screen.getByRole("button", { name: "Accept lease" }));

    expect(
      screen.getByText("You must acknowledge the lease terms to continue"),
    ).toBeInTheDocument();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("claims the invite with no body once acknowledged", async () => {
    mockMutateAsync.mockResolvedValueOnce(undefined);
    render(<ClaimConfirm invite={invite} token="tok_123" />);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Accept lease" }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledWith({ token: "tok_123" }));
  });

  it("shows the email-mismatch view when the server rejects with 403", async () => {
    mockMutateAsync.mockRejectedValueOnce(forbiddenError());
    render(<ClaimConfirm invite={invite} token="tok_123" />);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Accept lease" }));

    expect(
      await screen.findByRole("heading", { name: /different account/i }),
    ).toBeInTheDocument();
  });

  it("shows a generic error when the claim fails for another reason", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("network"));
    render(<ClaimConfirm invite={invite} token="tok_123" />);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Accept lease" }));

    expect(
      await screen.findByText("We couldn't accept this invite. Please try again."),
    ).toBeInTheDocument();
  });
});
