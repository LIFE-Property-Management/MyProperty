import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Navbar } from "../Navbar";

describe("<Navbar />", () => {
  it("renders brand, nav children, and actions", () => {
    render(
      <Navbar brand="MyProperty" actions={<button>Sign out</button>}>
        <a href="/dashboard">Dashboard</a>
      </Navbar>,
    );
    expect(screen.getByText("MyProperty")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Dashboard" })[0]).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Sign out" })[0]).toBeInTheDocument();
  });

  it("exposes a toggle with aria-label and starts closed (aria-expanded='false')", () => {
    render(<Navbar brand="Brand">links</Navbar>);
    const toggle = screen.getByRole("button", { name: /toggle menu/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("opens the mobile menu on toggle click and toggles aria-expanded", async () => {
    render(
      <Navbar brand="Brand" actions={<a href="/out">Sign out</a>}>
        <a href="/d">Dashboard</a>
      </Navbar>,
    );
    const toggle = screen.getByRole("button", { name: /toggle menu/i });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    // Mobile menu re-renders children below — that's duplicated, which is fine.
    const dashboardLinks = screen.getAllByRole("link", { name: "Dashboard" });
    expect(dashboardLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("is a <nav> landmark", () => {
    const { container } = render(<Navbar brand="Brand">x</Navbar>);
    expect(within(container).getByRole("navigation")).toBeInTheDocument();
  });
});
