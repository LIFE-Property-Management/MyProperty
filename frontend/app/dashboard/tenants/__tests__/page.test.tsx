import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { useLandlordTenants } from "@/lib/hooks/useLandlordTenants";
import { tenantsFixture, buildTenantsResponse } from "@/mocks/fixtures";
import type { LandlordTenantRow, TenantsResponse } from "@/lib/types/landlord/tenant";
import TenantsPage from "../page";

// Behaviour is driven entirely by useLandlordTenants, so we mock it and feed a
// query-result per test. No QueryClientProvider needed (no real useQuery runs).
// DataTable / Pagination / Spinner / Badge render for real and we assert on
// their output. Mirrors app/dashboard/properties/__tests__/page.test.tsx.
jest.mock("@/lib/hooks/useLandlordTenants");

jest.mock("next/link", () => {
  const MockLink = ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
  MockLink.displayName = "MockLink";
  return MockLink;
});

const mockTenants = useLandlordTenants as jest.MockedFunction<typeof useLandlordTenants>;

// Mirrors PAGE_SIZE in ../page.
const PAGE_SIZE = 10;

function makeResponse(
  items: LandlordTenantRow[],
  totalCount = items.length,
): TenantsResponse {
  return {
    items,
    totalCount,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
  };
}

function makeQueryReturn(
  overrides: Partial<ReturnType<typeof useLandlordTenants>> = {},
) {
  return {
    data: buildTenantsResponse(1, PAGE_SIZE),
    isLoading: false,
    isError: false,
    isFetching: false,
    isSuccess: true,
    ...overrides,
  } as ReturnType<typeof useLandlordTenants>;
}

beforeEach(() => {
  mockTenants.mockClear();
  mockTenants.mockReturnValue(makeQueryReturn());
});

describe("TenantsPage", () => {
  describe("loading state", () => {
    it("renders a full-page spinner and neither the heading nor a table", () => {
      // Unlike the properties page, loading returns early before the heading/table.
      mockTenants.mockReturnValue(makeQueryReturn({ isLoading: true, data: undefined }));
      render(<TenantsPage />);

      expect(document.querySelector("svg")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Tenants" })).toBeNull();
      expect(screen.queryByRole("table")).toBeNull();
    });
  });

  describe("error state", () => {
    it("shows the failure message and renders neither the heading nor a table", () => {
      mockTenants.mockReturnValue(makeQueryReturn({ isError: true, data: undefined }));
      render(<TenantsPage />);

      expect(screen.getByText("Failed to load tenants.")).toBeInTheDocument();
      expect(screen.getByText("Please refresh the page.")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Tenants" })).toBeNull();
      expect(screen.queryByRole("table")).toBeNull();
    });
  });

  describe("empty state", () => {
    it('shows "No tenants found." and no pagination', () => {
      mockTenants.mockReturnValue(makeQueryReturn({ data: makeResponse([], 0) }));
      render(<TenantsPage />);

      expect(screen.getByText("No tenants found.")).toBeInTheDocument();
      expect(screen.queryByText(/\d+ tenant/)).toBeNull();
      expect(screen.queryByRole("button", { name: "Page 2" })).toBeNull();
    });
  });

  describe("missing data (defensive fallback)", () => {
    it("renders the empty table gracefully when data is undefined outside loading/error", () => {
      // Not loading and not an error, yet no data — exercises the `?? 0` and
      // `?? []` fallbacks on the totalCount / items reads.
      mockTenants.mockReturnValue(makeQueryReturn({ data: undefined }));
      render(<TenantsPage />);

      expect(screen.getByRole("heading", { name: "Tenants" })).toBeInTheDocument();
      expect(screen.getByText("No tenants found.")).toBeInTheDocument();
      expect(screen.queryByText(/\d+ tenant/)).toBeNull();
      expect(screen.queryByRole("button", { name: "Page 2" })).toBeNull();
    });
  });

  describe("populated state", () => {
    it("renders the tenant's full name as a link to their detail page", () => {
      render(<TenantsPage />);

      const first = tenantsFixture[0]; // John Smith
      const link = screen.getByRole("link", { name: "John Smith" });
      expect(link).toHaveAttribute("href", `/dashboard/tenants/${first.tenantId}`);
    });

    it("renders the email and property columns", () => {
      render(<TenantsPage />);
      expect(screen.getByText("john.smith@example.com")).toBeInTheDocument();
      expect(screen.getByText("Maple Apartments 12")).toBeInTheDocument();
    });

    it("renders all five column headers", () => {
      render(<TenantsPage />);
      ["Tenant", "Email", "Property", "Lease End", "Status"].forEach((header) => {
        expect(screen.getByRole("columnheader", { name: header })).toBeInTheDocument();
      });
    });
  });

  describe("lease-status badge tone", () => {
    // Page 1 of the fixture contains Active, Expired and Terminated rows, so a
    // single render exercises every branch of LEASE_STATUS_TONE. The tone is
    // expressed only as a CSS class on the Badge, so we assert the class.
    it("maps Active → success tone", () => {
      render(<TenantsPage />);
      screen
        .getAllByText("Active")
        .forEach((badge) => expect(badge).toHaveClass("text-success"));
    });

    it("maps Expired → neutral tone", () => {
      render(<TenantsPage />);
      screen
        .getAllByText("Expired")
        .forEach((badge) => expect(badge).toHaveClass("text-muted-text"));
    });

    it("maps Terminated → danger tone", () => {
      render(<TenantsPage />);
      screen
        .getAllByText("Terminated")
        .forEach((badge) => expect(badge).toHaveClass("text-danger"));
    });
  });

  describe("count summary", () => {
    it('pluralizes as "tenants" when there is more than one', () => {
      render(<TenantsPage />);
      expect(screen.getByText("15 tenants")).toBeInTheDocument();
    });

    it('uses the singular "tenant" when totalCount is 1', () => {
      mockTenants.mockReturnValue(
        makeQueryReturn({ data: makeResponse([tenantsFixture[0]], 1) }),
      );
      render(<TenantsPage />);
      expect(screen.getByText("1 tenant")).toBeInTheDocument();
    });
  });

  describe("pagination", () => {
    it("renders a Page 2 button when totalCount exceeds PAGE_SIZE", () => {
      render(<TenantsPage />);
      expect(screen.getByRole("button", { name: "Page 2" })).toBeInTheDocument();
    });

    it("hides pagination at the boundary where totalCount equals PAGE_SIZE", () => {
      mockTenants.mockReturnValue(
        makeQueryReturn({
          data: makeResponse(tenantsFixture.slice(0, PAGE_SIZE), PAGE_SIZE),
        }),
      );
      render(<TenantsPage />);
      expect(screen.queryByRole("button", { name: "Page 2" })).toBeNull();
    });

    it("refetches with the next page when Page 2 is clicked", () => {
      render(<TenantsPage />);
      fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
      expect(mockTenants).toHaveBeenLastCalledWith(2, PAGE_SIZE);
    });
  });
});
