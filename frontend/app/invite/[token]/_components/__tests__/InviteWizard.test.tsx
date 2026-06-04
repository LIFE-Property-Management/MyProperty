import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { InviteWizard } from "../InviteWizard";
import { mockInvitePreview } from "../../_lib/invite";

// Mock the mutation hook so the wizard's submit path is observable without a
// QueryClient or a real router. mock-prefixed names are safe to reference from
// the hoisted jest.mock factory.
const mockMutateAsync = jest.fn();
let mockIsPending = false;

jest.mock("../../_lib/useAcceptInvite", () => ({
  useAcceptInvite: () => ({ mutateAsync: mockMutateAsync, isPending: mockIsPending }),
}));

const invite = mockInvitePreview("tok_123");

function makeIdFile(): File {
  return new File([new Uint8Array(1024)], "id.png", { type: "image/png" });
}

// Drive the form from step 0 to step 2 with valid input at each gate.
async function advanceToAccountStep(): Promise<void> {
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "Accept and verify" });

  fireEvent.change(screen.getByLabelText(/signature/i), {
    target: { value: "Jane Q. Doe" },
  });
  fireEvent.change(screen.getByLabelText(/ID document/i), {
    target: { files: [makeIdFile()] },
  });
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
  mockIsPending = false;
});

describe("InviteWizard", () => {
  it("starts on the review step with Back disabled", () => {
    render(<InviteWizard invite={invite} />);

    expect(screen.getByRole("heading", { name: "Review your lease" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  });

  it("blocks advancing past review until the lease is acknowledged", async () => {
    render(<InviteWizard invite={invite} />);

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(
      await screen.findByText("You must acknowledge the lease terms to continue"),
    ).toBeInTheDocument();
    // Still on the review step — never reached "Accept and verify".
    expect(screen.getByRole("heading", { name: "Review your lease" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Accept and verify" }),
    ).toBeNull();
  });

  it("advances through all three steps with valid input", async () => {
    render(<InviteWizard invite={invite} />);
    await advanceToAccountStep();

    // At the final step the primary action becomes the submit button.
    expect(
      screen.getByRole("button", { name: "Accept & create account" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
  });

  it("goes back to the previous step when Back is clicked", async () => {
    render(<InviteWizard invite={invite} />);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Accept and verify" });

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(
      await screen.findByRole("heading", { name: "Review your lease" }),
    ).toBeInTheDocument();
  });

  it("submits only token/name/password and shows the success step on success", async () => {
    mockMutateAsync.mockResolvedValueOnce(undefined);
    render(<InviteWizard invite={invite} />);

    await advanceToAccountStep();
    fillAccountStep();
    fireEvent.click(screen.getByRole("button", { name: "Accept & create account" }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    // The mock flow validates the signature + ID client-side but only the
    // account fields and token are sent to the endpoint.
    expect(mockMutateAsync).toHaveBeenCalledWith({
      token: "tok_123",
      firstName: "Jane",
      lastName: "Doe",
      password: "secret123",
    });

    expect(await screen.findByRole("heading", { name: /all set/i })).toBeInTheDocument();
    expect(screen.getByText(invite.tenantEmail)).toBeInTheDocument();
  });

  it("shows an error alert and stays on the form when submission fails", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("network"));
    render(<InviteWizard invite={invite} />);

    await advanceToAccountStep();
    fillAccountStep();
    fireEvent.click(screen.getByRole("button", { name: "Accept & create account" }));

    expect(
      await screen.findByText("We couldn't submit your acceptance. Please try again."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /all set/i })).toBeNull();
  });

  it("shows a submitting state and disables actions while the mutation is pending", async () => {
    mockIsPending = true;
    render(<InviteWizard invite={invite} />);
    await advanceToAccountStep();

    expect(screen.getByRole("button", { name: /submitting/i })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Accept & create account" }),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
  });
});
