import { render, screen, fireEvent, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { DashboardShell } from "../DashboardShell";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

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

jest.mock("@/lib/hooks/useMediaQuery", () => ({
  useMediaQuery: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  document.body.style.overflow = "";
  (useMediaQuery as jest.Mock).mockReturnValue(true); // desktop default
  (usePathname as jest.Mock).mockReturnValue("/dashboard");
});

describe("DashboardShell", () => {
  it("renders children inside <main id=\"main-content\">", () => {
    render(
      <DashboardShell>
        <div data-testid="child">hello</div>
      </DashboardShell>
    );
    const main = document.getElementById("main-content");
    expect(main).not.toBeNull();
    expect(main).toContainElement(screen.getByTestId("child"));
  });

  it("renders the three nav links", () => {
    render(<DashboardShell><div /></DashboardShell>);
    const nav = screen.getByRole("navigation", { name: /landlord navigation/i });
    expect(within(nav).getByText("Dashboard")).toBeInTheDocument();
    expect(within(nav).getByText("Properties")).toBeInTheDocument();
    expect(within(nav).getByText("Tenants")).toBeInTheDocument();
  });

  it("renders the brand MyProperty", () => {
    render(<DashboardShell><div /></DashboardShell>);
    expect(screen.getByText("MyProperty")).toBeInTheDocument();
  });

  it("renders the AccountBlock placeholder", () => {
    render(<DashboardShell><div /></DashboardShell>);
    expect(screen.getAllByText("Landlord").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("L")).toBeInTheDocument();
  });

  it("mobile top bar shows page title from pathname lookup — /dashboard/properties → Properties", () => {
    (usePathname as jest.Mock).mockReturnValue("/dashboard/properties");
    render(<DashboardShell><div /></DashboardShell>);
    const header = document.querySelector("header");
    expect(header).not.toBeNull();
    expect(header!.textContent).toContain("Properties");
  });

  it("mobile top bar falls back to Dashboard for unknown pathname", () => {
    (usePathname as jest.Mock).mockReturnValue("/dashboard/unknown-route");
    render(<DashboardShell><div /></DashboardShell>);
    const header = document.querySelector("header");
    expect(header).not.toBeNull();
    expect(header!.textContent).toContain("Dashboard");
  });

  it("hamburger button has correct ARIA initially", () => {
    render(<DashboardShell><div /></DashboardShell>);
    const hamburger = screen.getByRole("button", { name: /open navigation/i });
    expect(hamburger).toHaveAttribute("aria-expanded", "false");
    expect(hamburger).toHaveAttribute("aria-label", "Open navigation");
  });

  it("clicking the hamburger sets aria-expanded to true", () => {
    (useMediaQuery as jest.Mock).mockReturnValue(false);
    render(<DashboardShell><div /></DashboardShell>);
    const hamburger = screen.getByRole("button", { name: /open navigation/i });
    fireEvent.click(hamburger);
    expect(hamburger).toHaveAttribute("aria-expanded", "true");
  });

  it("focus returns to hamburger when sidebar closes via Escape", () => {
    (useMediaQuery as jest.Mock).mockReturnValue(false);
    render(<DashboardShell><div /></DashboardShell>);
    const hamburger = screen.getByRole("button", { name: /open navigation/i });
    fireEvent.click(hamburger);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(hamburger);
  });

  it("focus returns to hamburger when sidebar closes via backdrop click", () => {
    (useMediaQuery as jest.Mock).mockReturnValue(false);
    render(<DashboardShell><div /></DashboardShell>);
    const hamburger = screen.getByRole("button", { name: /open navigation/i });
    fireEvent.click(hamburger);
    const backdrop = document.querySelector(".bg-primary-text\\/40");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(document.activeElement).toBe(hamburger);
  });
});
