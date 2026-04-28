import { render, screen } from "@testing-library/react";
import type { LeaseSummary } from "@/lib/types";

jest.mock("../../../../lib/hooks", () => ({
  useLease: jest.fn(),
  useAuth: jest.fn(),
}));

import { useLease, useAuth } from "../../../../lib/hooks";
import { LeaseSummaryCard } from "../LeaseSummaryCard";

const mockedUseLease = useLease as jest.MockedFunction<typeof useLease>;
const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const LEASE: LeaseSummary = {
  id: "1c7e4f88-2d5a-4f93-bb20-7a6c8e1d4f02",
  propertyId: "a9e5b3d1-6f24-4e8c-9a13-5d7b2c8e0f64",
  propertyName: "Banesa Pejton",
  propertyAddress: "Rruga Fehmi Agani 12",
  unitNumber: "3A",
  landlordName: "Albana Krasniqi",
  startDate: "2025-05-01",
  endDate: "2026-04-30",
  monthlyRent: 350,
  currency: "EUR",
  status: "Active",
};

function setLease(value: {
  data?: LeaseSummary;
  isLoading?: boolean;
  isError?: boolean;
}): void {
  mockedUseLease.mockReturnValue({
    data: value.data,
    isLoading: value.isLoading ?? false,
    isError: value.isError ?? false,
  } as unknown as ReturnType<typeof useLease>);
}

beforeEach(() => {
  mockedUseLease.mockReset();
  mockedUseAuth.mockReturnValue({
    user: null,
    isAuthenticated: false,
    isReadOnly: false,
    isMeLoading: false,
    signOut: jest.fn(),
  });
});

describe("<LeaseSummaryCard />", () => {
  it("shows a spinner while loading", () => {
    setLease({ isLoading: true });
    render(<LeaseSummaryCard />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("shows a spinner while /me is loading", () => {
    setLease({ data: LEASE });
    mockedUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isReadOnly: false,
      isMeLoading: true,
      signOut: jest.fn(),
    });
    render(<LeaseSummaryCard />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("shows an error message when the query errors", () => {
    setLease({ isError: true });
    render(<LeaseSummaryCard />);
    expect(screen.getByText(/could not load lease details/i)).toBeInTheDocument();
  });

  it("renders all six fields when data is loaded", () => {
    setLease({ data: LEASE });
    render(<LeaseSummaryCard />);
    expect(screen.getByText("Lease Summary")).toBeInTheDocument();
    expect(screen.getByText("Banesa Pejton")).toBeInTheDocument();
    expect(screen.getByText(/Rruga Fehmi Agani 12/)).toBeInTheDocument();
    expect(screen.getByText("Albana Krasniqi")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    // currency number appears (en-US → €350.00)
    expect(screen.getByText((c) => c.includes("350"))).toBeInTheDocument();
  });

  it("appends unit number to the address when present", () => {
    setLease({ data: LEASE });
    render(<LeaseSummaryCard />);
    expect(screen.getByText(/Unit 3A/)).toBeInTheDocument();
  });

  it("omits unit suffix when unitNumber is null", () => {
    setLease({ data: { ...LEASE, unitNumber: null } });
    render(<LeaseSummaryCard />);
    expect(screen.queryByText(/Unit /)).not.toBeInTheDocument();
  });

  it("shows the read-only banner inside the card when tenant is read-only", () => {
    mockedUseAuth.mockReturnValue({
      user: { portal: "tenant", sub: "u1", email: "a@a.com" },
      isAuthenticated: true,
      isReadOnly: true,
      isMeLoading: false,
      signOut: jest.fn(),
    });
    setLease({ data: LEASE });
    render(<LeaseSummaryCard />);
    expect(screen.getByRole("status")).toHaveTextContent(/read-only mode/i);
  });

  it("hides the read-only banner for Active tenants", () => {
    setLease({ data: LEASE });
    render(<LeaseSummaryCard />);
    expect(screen.queryByText(/read-only mode/i)).not.toBeInTheDocument();
  });
});
