import { render, screen } from "@testing-library/react";
import { InviteWizard } from "../InviteWizard";
import { useAuth } from "@/lib/hooks/useAuth";
import type { InvitePreview } from "../../_lib/invite";

// InviteWizard is the three-case router. We mock useAuth to drive each case and
// stub the leaf components so this test owns only the branching decision.
jest.mock("@/lib/hooks/useAuth", () => ({ useAuth: jest.fn() }));
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

jest.mock("../NewUserAcceptForm", () => ({
  NewUserAcceptForm: ({ token }: { token: string }) => (
    <div data-testid="new-user">new user {token}</div>
  ),
}));
jest.mock("../ClaimConfirm", () => ({
  ClaimConfirm: ({ token }: { token: string }) => (
    <div data-testid="claim">claim {token}</div>
  ),
}));
jest.mock("../EmailMismatchView", () => ({
  EmailMismatchView: ({ invitedEmail }: { invitedEmail: string }) => (
    <div data-testid="mismatch">mismatch {invitedEmail}</div>
  ),
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

function authValue(overrides: Partial<ReturnType<typeof useAuth>> = {}): ReturnType<typeof useAuth> {
  return {
    user: null,
    isAuthenticated: false,
    isReadOnly: false,
    isMeLoading: false,
    signOut: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mockUseAuth.mockReset();
});

describe("InviteWizard (three-case router)", () => {
  it("renders the new-user accept form when not signed in", () => {
    mockUseAuth.mockReturnValue(authValue());
    render(<InviteWizard invite={invite} token="tok_123" />);

    expect(screen.getByTestId("new-user")).toHaveTextContent("new user tok_123");
  });

  it("renders the claim confirmation when signed in with the invited email", () => {
    mockUseAuth.mockReturnValue(
      authValue({
        isAuthenticated: true,
        user: { portal: "tenant", sub: "u1", email: "tenant@example.com" },
      }),
    );
    render(<InviteWizard invite={invite} token="tok_123" />);

    expect(screen.getByTestId("claim")).toHaveTextContent("claim tok_123");
  });

  it("matches the invited email case-insensitively", () => {
    mockUseAuth.mockReturnValue(
      authValue({
        isAuthenticated: true,
        user: { portal: "tenant", sub: "u1", email: "TENANT@example.com" },
      }),
    );
    render(<InviteWizard invite={invite} token="tok_123" />);

    expect(screen.getByTestId("claim")).toBeInTheDocument();
  });

  it("renders the email-mismatch view when signed in with a different email", () => {
    mockUseAuth.mockReturnValue(
      authValue({
        isAuthenticated: true,
        user: { portal: "tenant", sub: "u1", email: "someone.else@example.com" },
      }),
    );
    render(<InviteWizard invite={invite} token="tok_123" />);

    expect(screen.getByTestId("mismatch")).toHaveTextContent("mismatch tenant@example.com");
  });
});
