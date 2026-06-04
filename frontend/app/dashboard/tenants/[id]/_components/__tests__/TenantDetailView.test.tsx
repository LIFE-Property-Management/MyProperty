import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { useLandlordTenantDetail } from "@/lib/hooks/useLandlordTenantDetail";
import { formatDate } from "@/lib/utils/formatDate";
import { tenantDetailFixtures } from "@/mocks/fixtures";
import type { TenantDetail } from "@/lib/types/landlord/tenant";
import TenantDetailView from "../TenantDetailView";

// The view is driven by useLandlordTenantDetail; we mock it and feed a
// query-result per test. Badge tone is expressed only as a CSS class, so the
// status tests assert the class rather than just the visible text. Money uses
// toLocaleString(), so expected strings are computed the same way the component
// does (locale-independent). Mirrors the existing dashboard test patterns.
jest.mock("@/lib/hooks/useLandlordTenantDetail");

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

const mockDetail = useLandlordTenantDetail as jest.MockedFunction<
  typeof useLandlordTenantDetail
>;

// John Smith: Active lease, EUR 1,200/mo, 5 payments spanning every status,
// with the first payment's submittedAt = null (the em-dash branch).
const detail = Object.values(tenantDetailFixtures)[0];

function makeQueryReturn(
  overrides: Partial<ReturnType<typeof useLandlordTenantDetail>> = {},
) {
  return {
    data: detail,
    isLoading: false,
    isError: false,
    isFetching: false,
    isSuccess: true,
    ...overrides,
  } as ReturnType<typeof useLandlordTenantDetail>;
}

beforeEach(() => {
  mockDetail.mockClear();
  mockDetail.mockReturnValue(makeQueryReturn());
});

describe("TenantDetailView", () => {
  describe("loading state", () => {
    it("renders a spinner and no tenant heading", () => {
      mockDetail.mockReturnValue(makeQueryReturn({ isLoading: true, data: undefined }));
      render(<TenantDetailView tenantId={detail.tenantId} />);

      expect(document.querySelector("svg")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: detail.fullName })).toBeNull();
    });
  });

  describe("error state", () => {
    it("shows the failure message", () => {
      mockDetail.mockReturnValue(makeQueryReturn({ isError: true, data: undefined }));
      render(<TenantDetailView tenantId={detail.tenantId} />);

      expect(screen.getByText("Failed to load tenant details.")).toBeInTheDocument();
      expect(screen.getByText("Please refresh the page.")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: detail.fullName })).toBeNull();
    });
  });

  describe("header", () => {
    it("renders the tenant's name as a heading and their email", () => {
      render(<TenantDetailView tenantId={detail.tenantId} />);
      expect(
        screen.getByRole("heading", { name: detail.fullName }),
      ).toBeInTheDocument();
      expect(screen.getByText(detail.email)).toBeInTheDocument();
    });

    it("renders a back link to the tenants list", () => {
      render(<TenantDetailView tenantId={detail.tenantId} />);
      const back = screen.getByRole("link", { name: /Tenants/ });
      expect(back).toHaveAttribute("href", "/dashboard/tenants");
    });
  });

  describe("lease summary", () => {
    it("renders the property name under its label", () => {
      render(<TenantDetailView tenantId={detail.tenantId} />);
      const label = screen.getByText("Property");
      expect(label.parentElement).toHaveTextContent(detail.propertyName);
    });

    it("renders the monthly rent formatted with its currency", () => {
      render(<TenantDetailView tenantId={detail.tenantId} />);
      const expectedRent = `${detail.currency} ${detail.monthlyRent.toLocaleString()}`;
      const label = screen.getByText("Monthly rent");
      expect(label.parentElement).toHaveTextContent(expectedRent);
    });

    it("maps the Active lease status to the success tone", () => {
      render(<TenantDetailView tenantId={detail.tenantId} />);
      // "Active" is unique here — payment statuses never use it.
      expect(screen.getByText("Active")).toHaveClass("text-success");
    });
  });

  describe("payment history", () => {
    it("pluralizes the payment count", () => {
      render(<TenantDetailView tenantId={detail.tenantId} />);
      expect(screen.getByText("5 payments")).toBeInTheDocument();
    });

    it("maps every payment status to the correct badge tone", () => {
      render(<TenantDetailView tenantId={detail.tenantId} />);
      expect(screen.getByText("Outstanding")).toHaveClass("text-warning");
      expect(screen.getByText("Pending")).toHaveClass("text-info");
      screen
        .getAllByText("Confirmed")
        .forEach((badge) => expect(badge).toHaveClass("text-success"));
      expect(screen.getByText("Rejected")).toHaveClass("text-danger");
    });

    it("renders an em-dash when a payment has no submittedAt", () => {
      render(<TenantDetailView tenantId={detail.tenantId} />);
      // The lease-period dash lives inside a larger text node, so this matches
      // only the standalone "—" cell of the unsubmitted (Outstanding) payment.
      expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("renders the formatted date when a payment has a submittedAt", () => {
      render(<TenantDetailView tenantId={detail.tenantId} />);
      const submitted = detail.paymentHistory[1].submittedAt!; // Pending row
      expect(screen.getAllByText(formatDate(submitted)).length).toBeGreaterThanOrEqual(1);
    });

    it('shows "No payment history." and a zero count when there are no payments', () => {
      const noPayments: TenantDetail = { ...detail, paymentHistory: [] };
      mockDetail.mockReturnValue(makeQueryReturn({ data: noPayments }));
      render(<TenantDetailView tenantId={detail.tenantId} />);

      expect(screen.getByText("No payment history.")).toBeInTheDocument();
      expect(screen.getByText("0 payments")).toBeInTheDocument();
    });

    it("uses the singular when there is exactly one payment", () => {
      const onePayment: TenantDetail = {
        ...detail,
        paymentHistory: [detail.paymentHistory[0]],
      };
      mockDetail.mockReturnValue(makeQueryReturn({ data: onePayment }));
      render(<TenantDetailView tenantId={detail.tenantId} />);

      expect(screen.getByText("1 payment")).toBeInTheDocument();
    });
  });
});
