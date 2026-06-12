import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AxiosError, type AxiosResponse } from "axios";
import { NewUserAcceptForm } from "../NewUserAcceptForm";
import { login } from "@/lib/auth/keycloak";
import type { InvitePreview } from "../../_lib/invite";

// Mock the mutation hook so the submit path is observable without a QueryClient
// or a real router; mock keycloak.login so the sign-in affordances are testable.
const mockMutateAsync = jest.fn();
let mockIsPending = false;

jest.mock("../../_lib/useAcceptInvite", () => ({
  useAcceptInvite: () => ({ mutateAsync: mockMutateAsync, isPending: mockIsPending }),
}));

jest.mock("@/lib/auth/keycloak", () => ({ login: jest.fn() }));
const mockLogin = login as jest.MockedFunction<typeof login>;

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

function conflictError(): AxiosError {
  return new AxiosError(
    "conflict",
    "ERR_BAD_REQUEST",
    undefined,
    undefined,
    { status: 409 } as AxiosResponse,
  );
}

async function advanceToAccountStep(): Promise<void> {
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "Create your account" });
}

function fillAccountStep(): void {
  fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Jane" } });
  fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Doe" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "secret123" },
  });
}

beforeEach(() => {
  mockMutateAsync.mockReset();
  mockLogin.mockReset();
  mockIsPending = false;
});

describe("NewUserAcceptForm", () => {
  it("starts on the review step with Back disabled", () => {
    render(<NewUserAcceptForm invite={invite} token="tok_123" />);

    expect(screen.getByRole("heading", { name: "Review your lease" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  });

  it("blocks advancing past review until the lease is acknowledged", async () => {
    render(<NewUserAcceptForm invite={invite} token="tok_123" />);

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      await screen.findByText("You must acknowledge the lease terms to continue"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Create your account" })).toBeNull();
  });

  it("advances from review to the account step with valid input", async () => {
    render(<NewUserAcceptForm invite={invite} token="tok_123" />);
    await advanceToAccountStep();

    expect(screen.getByRole("button", { name: "Accept & create account" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
  });

  it("submits only token/name/password and shows the success step on success", async () => {
    mockMutateAsync.mockResolvedValueOnce(undefined);
    render(<NewUserAcceptForm invite={invite} token="tok_123" />);

    await advanceToAccountStep();
    fillAccountStep();
    fireEvent.click(screen.getByRole("button", { name: "Accept & create account" }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    expect(mockMutateAsync).toHaveBeenCalledWith({
      token: "tok_123",
      firstName: "Jane",
      lastName: "Doe",
      password: "secret123",
    });
    expect(await screen.findByRole("heading", { name: /all set/i })).toBeInTheDocument();
  });

  it("shows a generic error and stays on the form when submission fails", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("network"));
    render(<NewUserAcceptForm invite={invite} token="tok_123" />);

    await advanceToAccountStep();
    fillAccountStep();
    fireEvent.click(screen.getByRole("button", { name: "Accept & create account" }));

    expect(
      await screen.findByText("We couldn't submit your acceptance. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /all set/i })).toBeNull();
  });

  it("switches to a sign-in CTA when the email already has an account (409)", async () => {
    mockMutateAsync.mockRejectedValueOnce(conflictError());
    render(<NewUserAcceptForm invite={invite} token="tok_123" />);

    await advanceToAccountStep();
    fillAccountStep();
    fireEvent.click(screen.getByRole("button", { name: "Accept & create account" }));

    expect(
      await screen.findByRole("heading", { name: /already have an account/i }),
    ).toBeInTheDocument();
    // The form is gone; the CTA bounces to Keycloak and back to this invite.
    expect(screen.queryByRole("heading", { name: "Create your account" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /go to sign in/i }));
    expect(mockLogin).toHaveBeenCalledWith("http://localhost/invite/tok_123");
  });

  it("offers a sign-in link for returning tenants that bounces back to the invite", () => {
    render(<NewUserAcceptForm invite={invite} token="tok_123" />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(mockLogin).toHaveBeenCalledWith("http://localhost/invite/tok_123");
  });
});
