import { render, screen, fireEvent } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { LayoutDashboard, Home, Users } from "lucide-react";
import { Sidebar } from "../Sidebar";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
}));

jest.mock("next/link", () => {
  const MockLink = ({ children, href, ...props }: any) => (
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

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/properties", label: "Properties", icon: Home },
  { href: "/dashboard/tenants", label: "Tenants", icon: Users },
];

const noop = () => {};

beforeEach(() => {
  jest.clearAllMocks();
  document.body.style.overflow = "";
  (useMediaQuery as jest.Mock).mockReturnValue(true);
  (usePathname as jest.Mock).mockReturnValue("/dashboard");
});

describe("<Sidebar />", () => {
  it("renders all nav item labels", () => {
    render(<Sidebar navItems={navItems} isOpen={false} onClose={noop} />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Properties")).toBeInTheDocument();
    expect(screen.getByText("Tenants")).toBeInTheDocument();
  });

  it("renders the brand slot when provided", () => {
    render(
      <Sidebar
        navItems={navItems}
        brand={<span>BRAND</span>}
        isOpen={false}
        onClose={noop}
      />,
    );
    expect(screen.getByText("BRAND")).toBeInTheDocument();
  });

  it("renders the account slot when provided", () => {
    render(
      <Sidebar
        navItems={navItems}
        accountSlot={<span>ACCOUNT</span>}
        isOpen={false}
        onClose={noop}
      />,
    );
    expect(screen.getByText("ACCOUNT")).toBeInTheDocument();
  });

  describe("active state", () => {
    it.each([
      ["/dashboard", "Dashboard", true],
      ["/dashboard/properties", "Dashboard", false],
      ["/dashboard/tenants", "Tenants", true],
      ["/dashboard/tenants/abc-123", "Tenants", true],
    ] as const)(
      "pathname=%s → %s active=%s",
      (pathname, label, expectedActive) => {
        (usePathname as jest.Mock).mockReturnValue(pathname);
        render(<Sidebar navItems={navItems} isOpen={false} onClose={noop} />);
        const link = screen.getByText(label).closest("a");
        if (expectedActive) {
          expect(link).toHaveAttribute("aria-current", "page");
        } else {
          expect(link).not.toHaveAttribute("aria-current");
        }
      },
    );
  });

  describe("mobile drawer translation classes", () => {
    beforeEach(() => {
      (useMediaQuery as jest.Mock).mockReturnValue(false);
    });

    it("has -translate-x-full when closed", () => {
      const { container } = render(
        <Sidebar navItems={navItems} isOpen={false} onClose={noop} />,
      );
      const nav = container.querySelector("nav");
      expect(nav).toHaveClass("-translate-x-full");
      expect(nav).not.toHaveClass("translate-x-0");
    });

    it("has translate-x-0 when open", () => {
      const { container } = render(
        <Sidebar navItems={navItems} isOpen={true} onClose={noop} />,
      );
      const nav = container.querySelector("nav");
      expect(nav).toHaveClass("translate-x-0");
      expect(nav).not.toHaveClass("-translate-x-full");
    });
  });

  it("calls onClose when the backdrop is clicked", () => {
    const onClose = jest.fn();
    (useMediaQuery as jest.Mock).mockReturnValue(false);
    const { container } = render(
      <Sidebar navItems={navItems} isOpen={true} onClose={onClose} />,
    );
    const backdrop = container.querySelector(".bg-primary-text\\/40");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape is pressed while open", () => {
    const onClose = jest.fn();
    render(<Sidebar navItems={navItems} isOpen={true} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when Escape is pressed while closed", () => {
    const onClose = jest.fn();
    render(<Sidebar navItems={navItems} isOpen={false} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("uses a custom ariaLabel when provided", () => {
    const { container } = render(
      <Sidebar
        navItems={navItems}
        isOpen={false}
        onClose={noop}
        ariaLabel="Landlord nav"
      />,
    );
    const nav = container.querySelector("nav");
    expect(nav).toHaveAttribute("aria-label", "Landlord nav");
  });

  it("defaults to 'Sidebar navigation' aria-label", () => {
    const { container } = render(
      <Sidebar navItems={navItems} isOpen={false} onClose={noop} />,
    );
    const nav = container.querySelector("nav");
    expect(nav).toHaveAttribute("aria-label", "Sidebar navigation");
  });

  it("calls onClose when a nav link is clicked", () => {
    const onClose = jest.fn();
    render(<Sidebar navItems={navItems} isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("Properties"));
    expect(onClose).toHaveBeenCalled();
  });

  describe("body scroll lock", () => {
    it("sets body overflow to hidden when open", () => {
      render(<Sidebar navItems={navItems} isOpen={true} onClose={noop} />);
      expect(document.body.style.overflow).toBe("hidden");
    });

    it("restores body overflow on unmount", () => {
      document.body.style.overflow = "auto";
      const { unmount } = render(
        <Sidebar navItems={navItems} isOpen={true} onClose={noop} />,
      );
      expect(document.body.style.overflow).toBe("hidden");
      unmount();
      expect(document.body.style.overflow).toBe("auto");
    });

    it("restores body overflow when isOpen flips false", () => {
      document.body.style.overflow = "auto";
      const { rerender } = render(
        <Sidebar navItems={navItems} isOpen={true} onClose={noop} />,
      );
      expect(document.body.style.overflow).toBe("hidden");
      rerender(<Sidebar navItems={navItems} isOpen={false} onClose={noop} />);
      expect(document.body.style.overflow).toBe("auto");
    });
  });

  describe("focus management", () => {
    it("focuses the first nav link when the mobile drawer opens", () => {
      (useMediaQuery as jest.Mock).mockReturnValue(false);
      const { rerender } = render(
        <Sidebar navItems={navItems} isOpen={false} onClose={noop} />,
      );
      rerender(<Sidebar navItems={navItems} isOpen={true} onClose={noop} />);
      const firstLink = screen.getByText("Dashboard").closest("a");
      expect(document.activeElement).toBe(firstLink);
    });

    it("does not move focus when opening on desktop", () => {
      (useMediaQuery as jest.Mock).mockReturnValue(true);
      const focusSpy = jest.spyOn(HTMLElement.prototype, "focus");
      const { rerender } = render(
        <Sidebar navItems={navItems} isOpen={false} onClose={noop} />,
      );
      focusSpy.mockClear();
      rerender(<Sidebar navItems={navItems} isOpen={true} onClose={noop} />);
      expect(focusSpy).not.toHaveBeenCalled();
      focusSpy.mockRestore();
    });
  });

  describe("inert attribute", () => {
    it("is present on mobile when closed", () => {
      (useMediaQuery as jest.Mock).mockReturnValue(false);
      const { container } = render(
        <Sidebar navItems={navItems} isOpen={false} onClose={noop} />,
      );
      const nav = container.querySelector("nav");
      expect(nav).toHaveAttribute("inert");
    });

    it("is absent on mobile when open", () => {
      (useMediaQuery as jest.Mock).mockReturnValue(false);
      const { container } = render(
        <Sidebar navItems={navItems} isOpen={true} onClose={noop} />,
      );
      const nav = container.querySelector("nav");
      expect(nav).not.toHaveAttribute("inert");
    });

    it("is absent on desktop regardless of isOpen", () => {
      (useMediaQuery as jest.Mock).mockReturnValue(true);
      const { container, rerender } = render(
        <Sidebar navItems={navItems} isOpen={false} onClose={noop} />,
      );
      let nav = container.querySelector("nav");
      expect(nav).not.toHaveAttribute("inert");

      rerender(<Sidebar navItems={navItems} isOpen={true} onClose={noop} />);
      nav = container.querySelector("nav");
      expect(nav).not.toHaveAttribute("inert");
    });
  });
});
