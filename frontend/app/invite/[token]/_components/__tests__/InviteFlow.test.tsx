import { render, screen } from "@testing-library/react";
import { InviteFlow } from "../InviteFlow";
import type { InvitePreview } from "../../_lib/invite";

// Drive InviteFlow purely through the preview hook's state. The wizard itself is
// stubbed so this test owns only the loading / invalid / resolved branching.
const mockUsePreviewInvite = jest.fn();
jest.mock("../../_lib/usePreviewInvite", () => ({
  usePreviewInvite: (token: string) => mockUsePreviewInvite(token),
}));

// Auth detection is settled by default so the tests exercise the preview
// branches; the loading test overrides it.
let mockAuthReady = true;
jest.mock("../../_lib/useOptionalKeycloak", () => ({
  useOptionalKeycloak: () => mockAuthReady,
}));

jest.mock("../InviteWizard", () => ({
  InviteWizard: ({ token }: { token: string }) => (
    <div data-testid="wizard">wizard for {token}</div>
  ),
}));

const preview: InvitePreview = {
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

beforeEach(() => {
  mockUsePreviewInvite.mockReset();
  mockAuthReady = true;
});

describe("InviteFlow", () => {
  it("shows a loading state while the preview is pending", () => {
    mockUsePreviewInvite.mockReturnValue({ data: undefined, isPending: true, isError: false });
    render(<InviteFlow token="tok_123" />);

    expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
    expect(screen.queryByTestId("wizard")).toBeNull();
  });

  it("shows a loading state while auth detection is still settling", () => {
    mockAuthReady = false;
    mockUsePreviewInvite.mockReturnValue({ data: preview, isPending: false, isError: false });
    render(<InviteFlow token="tok_123" />);

    expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
    expect(screen.queryByTestId("wizard")).toBeNull();
  });

  it("shows the invalid-invite view when the preview fails (unknown token)", () => {
    mockUsePreviewInvite.mockReturnValue({ data: undefined, isPending: false, isError: true });
    render(<InviteFlow token="bad" />);

    expect(screen.getByRole("heading", { name: /isn't valid/i })).toBeInTheDocument();
    expect(screen.queryByTestId("wizard")).toBeNull();
  });

  it("renders the wizard with the token for a Pending invite", () => {
    mockUsePreviewInvite.mockReturnValue({ data: preview, isPending: false, isError: false });
    render(<InviteFlow token="tok_123" />);

    expect(screen.getByTestId("wizard")).toHaveTextContent("wizard for tok_123");
  });

  it.each([
    ["Accepted", /already accepted/i],
    ["Rejected", /declined/i],
    ["Expired", /expired/i],
    ["Revoked", /cancelled/i],
  ] as const)("shows the status view (not the wizard) for a %s invite", (status, heading) => {
    mockUsePreviewInvite.mockReturnValue({
      data: { ...preview, status },
      isPending: false,
      isError: false,
    });
    render(<InviteFlow token="tok_123" />);

    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(screen.queryByTestId("wizard")).toBeNull();
  });
});
