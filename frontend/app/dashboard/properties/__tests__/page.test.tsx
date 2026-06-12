import { screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { renderWithQuery } from "@/test-utils/renderWithQuery";
import { useLandlordProperties } from "@/lib/hooks/useLandlordProperties";
import { propertiesFixture, buildPropertiesResponse } from "@/mocks/fixtures";
import type { PropertyDto, PropertiesResponse } from "@/lib/types/landlord/property";
import PropertiesPage from "../page";

// The page's behaviour is driven entirely by what useLandlordProperties returns,
// so we mock the hook and feed it a query-result shape per test. The per-row
// PropertyOccupancyAction uses mutation hooks, so renders go through
// renderWithQuery (a QueryClientProvider) — no network is hit since the actions
// aren't triggered here. DataTable / Pagination / Spinner / Card render for real.
jest.mock("@/lib/hooks/useLandlordProperties");

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

const mockProperties = useLandlordProperties as jest.MockedFunction<
  typeof useLandlordProperties
>;

// Mirrors PAGE_SIZE in ../page — the page hardcodes 10.
const PAGE_SIZE = 10;

function makeResponse(
  items: PropertyDto[],
  totalCount = items.length,
): PropertiesResponse {
  return {
    items,
    totalCount,
    page: 1,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
  };
}

function makeQueryReturn(
  overrides: Partial<ReturnType<typeof useLandlordProperties>> = {},
) {
  return {
    data: buildPropertiesResponse(1, PAGE_SIZE),
    isLoading: false,
    isError: false,
    isFetching: false,
    isSuccess: true,
    ...overrides,
  } as ReturnType<typeof useLandlordProperties>;
}

beforeEach(() => {
  mockProperties.mockClear();
  mockProperties.mockReturnValue(makeQueryReturn());
});

describe("PropertiesPage", () => {
  describe("error state", () => {
    it("shows the failure message and renders neither the heading nor a table", () => {
      mockProperties.mockReturnValue(makeQueryReturn({ isError: true, data: undefined }));
      renderWithQuery(<PropertiesPage />);

      expect(screen.getByText("Failed to load properties.")).toBeInTheDocument();
      expect(screen.getByText("Please refresh the page.")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Properties" })).toBeNull();
      expect(screen.queryByRole("table")).toBeNull();
    });
  });

  describe("loading state", () => {
    it("renders the DataTable spinner and hides the count summary", () => {
      mockProperties.mockReturnValue(makeQueryReturn({ isLoading: true, data: undefined }));
      renderWithQuery(<PropertiesPage />);

      // Heading always renders outside the loading branch.
      expect(screen.getByRole("heading", { name: "Properties" })).toBeInTheDocument();
      // DataTable swaps its body for a spinner while isLoading.
      expect(document.querySelector("svg")).toBeInTheDocument();
      // The "N properties" summary is gated behind !isLoading.
      expect(screen.queryByText(/\d+ propert/)).toBeNull();
    });
  });

  describe("empty state", () => {
    it("shows the empty-state card (not the table) and no count or pagination", () => {
      mockProperties.mockReturnValue(makeQueryReturn({ data: makeResponse([], 0) }));
      renderWithQuery(<PropertiesPage />);

      // totalCount === 0 renders the dedicated empty card with its own CTA,
      // not the DataTable (so DataTable's "No properties found." never shows).
      expect(screen.getByText("You have no properties!")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Add your first property" })).toBeInTheDocument();
      expect(screen.queryByText(/\d+ propert/)).toBeNull();
      expect(screen.queryByRole("button", { name: "Page 2" })).toBeNull();
    });
  });

  describe("populated state", () => {
    it("renders each property name as a link to its detail page", () => {
      renderWithQuery(<PropertiesPage />);

      const first = propertiesFixture[0];
      const link = screen.getByRole("link", { name: first.name });
      expect(link).toHaveAttribute("href", `/dashboard/properties/${first.id}`);
    });

    it("renders the Name, Address and Added column headers", () => {
      renderWithQuery(<PropertiesPage />);

      expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Address" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Added" })).toBeInTheDocument();
    });
  });

  describe("address column", () => {
    it('appends ", Unit X" when unitNumber is present', () => {
      renderWithQuery(<PropertiesPage />);
      // Fixture row 0: address "Maple Street 12", unitNumber "A".
      expect(screen.getByText("Maple Street 12, Unit A")).toBeInTheDocument();
    });

    it("omits the unit suffix when unitNumber is null", () => {
      renderWithQuery(<PropertiesPage />);
      // Fixture row 3 (Birch House): address "Birch Street 18", unitNumber null.
      // Exact-text match confirms no ", Unit ..." was appended.
      expect(screen.getByText("Birch Street 18")).toBeInTheDocument();
    });
  });

  describe("count summary", () => {
    it('pluralizes as "properties" when there is more than one', () => {
      renderWithQuery(<PropertiesPage />);
      expect(screen.getByText("15 properties")).toBeInTheDocument();
    });

    it('uses the singular "property" when totalCount is 1', () => {
      mockProperties.mockReturnValue(
        makeQueryReturn({ data: makeResponse([propertiesFixture[0]], 1) }),
      );
      renderWithQuery(<PropertiesPage />);
      expect(screen.getByText("1 property")).toBeInTheDocument();
    });
  });

  describe("pagination", () => {
    it("renders a Page 2 button when totalCount exceeds PAGE_SIZE", () => {
      renderWithQuery(<PropertiesPage />);
      expect(screen.getByRole("button", { name: "Page 2" })).toBeInTheDocument();
    });

    it("hides pagination at the boundary where totalCount equals PAGE_SIZE", () => {
      mockProperties.mockReturnValue(
        makeQueryReturn({
          data: makeResponse(propertiesFixture.slice(0, PAGE_SIZE), PAGE_SIZE),
        }),
      );
      renderWithQuery(<PropertiesPage />);
      expect(screen.queryByRole("button", { name: "Page 2" })).toBeNull();
    });

    it("refetches with the next page when Page 2 is clicked", () => {
      renderWithQuery(<PropertiesPage />);
      fireEvent.click(screen.getByRole("button", { name: "Page 2" }));
      expect(mockProperties).toHaveBeenLastCalledWith(2, PAGE_SIZE);
    });
  });

  describe("background refetch", () => {
    it("shows an inline spinner beside the count while isFetching", () => {
      mockProperties.mockReturnValue(makeQueryReturn({ isFetching: true }));
      renderWithQuery(<PropertiesPage />);

      const summary = screen.getByText("15 properties");
      expect(summary.closest("p")?.querySelector("svg")).toBeInTheDocument();
    });
  });
});
