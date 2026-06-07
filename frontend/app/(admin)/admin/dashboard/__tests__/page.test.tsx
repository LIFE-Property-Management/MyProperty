import { render, screen } from "@testing-library/react";
import { useStakeholderDashboard } from "@/lib/hooks";
import { stakeholderDashboardFixture } from "@/mocks/fixtures";
import AdminDashboardPage from "../page";

jest.mock("@/lib/hooks", () => ({
  useStakeholderDashboard: jest.fn(),
}));

const mockDashboard = useStakeholderDashboard as jest.MockedFunction<
  typeof useStakeholderDashboard
>;

function makeReturn(overrides: Partial<ReturnType<typeof useStakeholderDashboard>> = {}) {
  return {
    data: stakeholderDashboardFixture,
    isLoading: false,
    isError: false,
    isSuccess: true,
    ...overrides,
  } as ReturnType<typeof useStakeholderDashboard>;
}

beforeEach(() => {
  mockDashboard.mockReset();
});

describe("<AdminDashboardPage />", () => {
  it("renders the four section headings", () => {
    mockDashboard.mockReturnValue(makeReturn());
    render(<AdminDashboardPage />);
    expect(screen.getByRole("heading", { name: "Growth & users" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Adoption & occupancy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Invites" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Financial & operations" })).toBeInTheDocument();
  });

  it("renders KPI values from the fixture", () => {
    mockDashboard.mockReturnValue(makeReturn());
    render(<AdminDashboardPage />);
    expect(screen.getByText("142")).toBeInTheDocument(); // total users
    expect(screen.getByText("79.7%")).toBeInTheDocument(); // occupancy 0.7969
    expect(screen.getByText("18.5 h")).toBeInTheDocument(); // avg time to confirm
  });

  it("renders a per-currency financial breakdown (never summed across currencies)", () => {
    mockDashboard.mockReturnValue(makeReturn());
    render(<AdminDashboardPage />);
    expect(screen.getByText("EUR 58,200")).toBeInTheDocument();
    expect(screen.getByText("USD 21,300")).toBeInTheDocument();
  });

  it("renders a chart container per trend series", () => {
    mockDashboard.mockReturnValue(makeReturn());
    render(<AdminDashboardPage />);
    // user growth + lease growth + invites + revenue(EUR) + revenue(USD) = 5
    expect(screen.getAllByTestId("trend-chart")).toHaveLength(5);
  });

  it("renders the system-health line", () => {
    mockDashboard.mockReturnValue(makeReturn());
    render(<AdminDashboardPage />);
    expect(screen.getByText(/failed email this month/i)).toBeInTheDocument();
  });

  it("shows an error state when the query fails", () => {
    mockDashboard.mockReturnValue(makeReturn({ data: undefined, isError: true, isSuccess: false }));
    render(<AdminDashboardPage />);
    expect(screen.getByText("Failed to load dashboard data.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Growth & users" })).not.toBeInTheDocument();
  });

  it("shows a loading state before data resolves", () => {
    mockDashboard.mockReturnValue(makeReturn({ data: undefined, isLoading: true, isSuccess: false }));
    render(<AdminDashboardPage />);
    expect(screen.queryByRole("heading", { name: "Growth & users" })).not.toBeInTheDocument();
  });
});
