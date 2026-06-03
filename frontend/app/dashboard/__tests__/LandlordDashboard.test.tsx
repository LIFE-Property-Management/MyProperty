import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { useLandlordDashboard } from "@/lib/hooks/useLandlordDashboard";
import { useLandlordUpcomingPayments } from "@/lib/hooks/useLandlordUpcomingPayments";
import { landlordDashboardFixture, buildUpcomingPaymentsResponse } from "@/mocks/fixtures";
import LandlordDashboard from "../LandlordDashboard";

jest.mock("@/lib/hooks/useLandlordDashboard");
jest.mock("@/lib/hooks/useLandlordUpcomingPayments");

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

const mockDashboard = useLandlordDashboard as jest.MockedFunction<typeof useLandlordDashboard>;
const mockUpcoming = useLandlordUpcomingPayments as jest.MockedFunction<
  typeof useLandlordUpcomingPayments
>;

const upcomingPage1 = buildUpcomingPaymentsResponse(1, 10);

function makeDashboardReturn(
  overrides: Partial<ReturnType<typeof useLandlordDashboard>> = {},
) {
  return {
    data: landlordDashboardFixture,
    isLoading: false,
    isError: false,
    isSuccess: true,
    ...overrides,
  } as ReturnType<typeof useLandlordDashboard>;
}

function makeUpcomingReturn(
  overrides: Partial<ReturnType<typeof useLandlordUpcomingPayments>> = {},
) {
  return {
    data: upcomingPage1,
    isLoading: false,
    isError: false,
    isSuccess: true,
    ...overrides,
  } as ReturnType<typeof useLandlordUpcomingPayments>;
}

beforeEach(() => {
  mockDashboard.mockReturnValue(makeDashboardReturn());
  mockUpcoming.mockReturnValue(makeUpcomingReturn());
});

describe("LandlordDashboard", () => {
  it("shows spinner when useLandlordDashboard returns isLoading: true", () => {
    mockDashboard.mockReturnValue(makeDashboardReturn({ isLoading: true, data: undefined }));
    render(<LandlordDashboard />);
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("shows error UI when useLandlordDashboard returns isError: true", () => {
    mockDashboard.mockReturnValue(makeDashboardReturn({ isError: true, data: undefined }));
    render(<LandlordDashboard />);
    expect(screen.getByText("Failed to load dashboard data.")).toBeInTheDocument();
  });

  it("renders stat values from the fixture", () => {
    render(<LandlordDashboard />);
    expect(screen.getByText("12")).toBeInTheDocument(); // totalProperties
    expect(screen.getAllByText("9").length).toBeGreaterThan(0); // activeTenants + activeLeases
  });

  it("renders overdue payments count", () => {
    render(<LandlordDashboard />);
    expect(screen.getByText("2")).toBeInTheDocument(); // overduePayments
  });

  it('renders "No upcoming payments." when upcoming items is empty', () => {
    mockUpcoming.mockReturnValue(
      makeUpcomingReturn({ data: { items: [], totalCount: 0, page: 1, pageSize: 10 } }),
    );
    render(<LandlordDashboard />);
    expect(screen.getByText("No upcoming payments.")).toBeInTheDocument();
  });

  it("renders Pagination page-2 button when totalCount=18 and PAGE_SIZE=10", () => {
    render(<LandlordDashboard />);
    expect(screen.getByRole("button", { name: "Page 2" })).toBeInTheDocument();
  });

  it("does not render Pagination when totalCount=5", () => {
    mockUpcoming.mockReturnValue(
      makeUpcomingReturn({
        data: {
          items: upcomingPage1.items.slice(0, 5),
          totalCount: 5,
          page: 1,
          pageSize: 10,
        },
      }),
    );
    render(<LandlordDashboard />);
    expect(screen.queryByRole("button", { name: "Page 2" })).toBeNull();
  });

  it("calls useLandlordUpcomingPayments with (1, 10) on initial render", () => {
    render(<LandlordDashboard />);
    expect(mockUpcoming).toHaveBeenCalledWith(1, 10);
  });
});
