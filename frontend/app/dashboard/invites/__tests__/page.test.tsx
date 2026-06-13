import { render, screen, fireEvent, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { useLandlordInvites } from "@/lib/hooks/useLandlordInvites";
import { buildLandlordInvitesResponse } from "@/mocks/fixtures";
import InvitesPage from "../page";

// The page is driven by useLandlordInvites, so we mock it. InviteRowActions is
// mocked to a marker (its own behaviour is covered in its own test) — that keeps
// this test free of a QueryClientProvider for the row mutation hooks.
jest.mock("@/lib/hooks/useLandlordInvites");

jest.mock("../_components/InviteRowActions", () => {
  const Stub = ({ invite }: { invite: { status: string } }) => (
    <span data-testid="row-actions">{invite.status}</span>
  );
  Stub.displayName = "InviteRowActionsStub";
  return Stub;
});

jest.mock("next/link", () => {
  const MockLink = ({ children, href, ...props }: { children: ReactNode; href: string; [k: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

const mockInvites = useLandlordInvites as jest.MockedFunction<typeof useLandlordInvites>;

const PAGE_SIZE = 10;

function makeQueryReturn(overrides: Partial<ReturnType<typeof useLandlordInvites>> = {}) {
  return {
    data: buildLandlordInvitesResponse(1, PAGE_SIZE),
    isLoading: false,
    isError: false,
    isFetching: false,
    isSuccess: true,
    ...overrides,
  } as ReturnType<typeof useLandlordInvites>;
}

beforeEach(() => {
  mockInvites.mockReset();
  mockInvites.mockReturnValue(makeQueryReturn());
});

describe("InvitesPage", () => {
  it("shows the failure message on error", () => {
    mockInvites.mockReturnValue(makeQueryReturn({ isError: true, data: undefined }));
    render(<InvitesPage />);
    expect(screen.getByText("Failed to load invitations.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("renders the empty card when there are no invitations and no filter", () => {
    mockInvites.mockReturnValue(
      makeQueryReturn({
        data: { items: [], totalCount: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 0 },
      }),
    );
    render(<InvitesPage />);
    expect(screen.getByText("No invitations yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to properties/i })).toBeInTheDocument();
  });

  it("renders invitees, status badges and a property link in the table", () => {
    render(<InvitesPage />);
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(table.getByText("ada.lovelace@example.com")).toBeInTheDocument();
    // Two Accepted invites on page 1 → two status badges inside the table.
    expect(table.getAllByText("Accepted").length).toBeGreaterThanOrEqual(1);
    expect(table.getByRole("link", { name: "Property 01" })).toHaveAttribute(
      "href",
      "/dashboard/properties/02900000-0000-7000-8000-000000000001",
    );
  });

  it("requests the chosen status filter and resets to page 1", () => {
    render(<InvitesPage />);
    fireEvent.click(screen.getByRole("button", { name: "Pending" }));
    expect(mockInvites).toHaveBeenLastCalledWith(1, PAGE_SIZE, "Pending");
  });

  it("paginates with the next page (filter cleared → undefined status)", () => {
    render(<InvitesPage />);
    fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
    expect(mockInvites).toHaveBeenLastCalledWith(2, PAGE_SIZE, undefined);
  });
});
